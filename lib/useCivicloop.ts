'use client';

/**
 * Client-side orchestration for the whole agent loop. Pure agents (dedup,
 * SLA sentinel) run here; anything that needs Mistral or the shared
 * self-healing graph goes through the Server Actions in `app/actions.ts`.
 *
 * Tickets and the agent log live in ONE state object so every mutation is a
 * single pure updater — React StrictMode may run an updater twice, and a
 * combined store means a double run can never emit duplicate log lines.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SLA_HOURS,
  compareSeverity,
  type AgentAuditLog,
  type AgentLogLevel,
  type AgentName,
  type AuthorityProfile,
  type CivicProofVerification,
  type CivicTicket,
  type DedupDecision,
  type Department,
  type EvidencePhoto,
  type GeoPoint,
  type IntakeDraft,
  type PublicReporter,
  type RoutingOverride,
  type Severity,
  type TicketStatus,
  type TicketSupporter,
} from '@/types/civic';
import { SEED_DATA, SEED_EPOCH } from '@/lib/seedData';
import { haversineMeters } from '@/lib/haversine';
import { auditLogForDedup, runDedupCluster } from '@/lib/agents/dedupClusterAgent';
import { auditLogsForTick, markSlaResolved, startSlaClock, tickSla } from '@/lib/agents/slaSentinelAgent';
import {
  analyzeIntakeAction,
  loadStateAction,
  persistAgentLogsAction,
  persistRoutingEventAction,
  persistSupporterAction,
  persistTicketAction,
  recordRerouteAction,
  resetDemoAction,
  triageAction,
  verifyProofAction,
} from '@/app/actions';
import type { CitizenConfirmationInput } from '@/components/CitizenDashboard';

/** Fire-and-forget durability write — never blocks the UI, never throws into a caller. */
function persist(promise: Promise<unknown>): void {
  promise.catch((error) => console.error('Civicloop: persistence write failed', error));
}

const HOUR_MS = 3_600_000;
const SENTINEL_INTERVAL_MS = 15_000;
const CLOSED_STATUSES = new Set<TicketStatus>(['Resolved', 'Rejected']);

interface Store {
  tickets: CivicTicket[];
  logs: AgentAuditLog[];
}

export interface IntakeResult {
  success: boolean;
  message: string;
  ticketId?: string;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function agentLog(
  ticketId: string | null,
  agent: AgentName,
  action: string,
  message: string,
  level: AgentLogLevel,
  payload: Record<string, unknown>,
  now: Date,
): AgentAuditLog {
  return {
    id: makeId(`log-${action}`),
    ticketId,
    agent,
    action,
    message,
    level,
    payload,
    confidence: null,
    latencyMs: 0,
    mode: 'live',
    createdAt: now.toISOString(),
  };
}

function nextReferenceCode(tickets: CivicTicket[], now: Date): string {
  const highest = tickets.reduce((max, ticket) => Math.max(max, Number(ticket.referenceCode.match(/(\d+)$/)?.[1] ?? 0)), 4800);
  return `CIVIC-${now.getFullYear()}-${String(highest + 1).padStart(6, '0')}`;
}

function makeTitle(category: string, text: string, location: GeoPoint): string {
  const firstSentence = text.split(/[.!?]\s/)[0]?.trim() ?? '';
  if (firstSentence.length >= 12) return firstSentence.length > 72 ? `${firstSentence.slice(0, 69)}…` : firstSentence;
  const place = location.address ?? location.ward;
  return place ? `${category} near ${place}` : `${category} reported by a citizen`;
}

function isInvolved(ticket: CivicTicket, reporterId: string): boolean {
  return ticket.reporter.id === reporterId || ticket.supporters.some((supporter) => supporter.reporter.id === reporterId);
}

/** Attaches a co-reporter to a master ticket, applying any crowd-driven severity escalation. Pure. */
function attachSupporter(
  master: CivicTicket,
  supporter: { reporter: PublicReporter; note: string | null; photos: EvidencePhoto[]; distanceMeters: number },
  decision: DedupDecision,
  escalatedSeverity: Severity | null,
  dedupLog: AgentAuditLog,
  now: Date,
): { ticket: CivicTicket; logs: AgentAuditLog[]; newSupporter: TicketSupporter } {
  const nowIso = now.toISOString();
  const logs: AgentAuditLog[] = [dedupLog];
  let severity = master.severity;
  let sla = master.sla;

  if (escalatedSeverity && compareSeverity(escalatedSeverity, master.severity) > 0) {
    const restarted = startSlaClock(escalatedSeverity, master.sla.startedAt);
    const tick = tickSla(
      {
        ...restarted,
        warnedAt: master.sla.warnedAt,
        breachedAt: master.sla.breachedAt,
        escalationLevel: master.sla.escalationLevel,
        escalatedTo: master.sla.escalatedTo,
        escalationBriefing: master.sla.escalationBriefing,
      },
      { referenceCode: master.referenceCode, department: master.assignedDepartment, impactCount: decision.impactCount, now },
    );
    sla = tick.state;
    severity = escalatedSeverity;
    logs.push(
      agentLog(
        master.id,
        'TriageRouting',
        'severity.escalate',
        `Severity raised ${master.severity} → ${escalatedSeverity} on crowd corroboration from ${decision.impactCount} citizens. SLA window now ${SLA_HOURS[escalatedSeverity]} h.`,
        'warning',
        { from: master.severity, to: escalatedSeverity, impactCount: decision.impactCount },
        now,
      ),
      ...auditLogsForTick(master.id, tick).map((log) => ({ ...log, createdAt: nowIso })),
    );
  }

  const newSupporter: TicketSupporter = {
    id: makeId(`${master.id}-sup`),
    ticketId: master.id,
    reporter: supporter.reporter,
    joinedAt: nowIso,
    distanceMeters: supporter.distanceMeters,
    note: supporter.note,
    photos: supporter.photos,
  };

  return {
    ticket: {
      ...master,
      severity,
      sla,
      supporters: [...master.supporters, newSupporter],
      impactCount: decision.impactCount,
      updatedAt: nowIso,
      auditLog: [...master.auditLog, ...logs],
    },
    logs,
    newSupporter,
  };
}

export function useCivicloop() {
  const [store, setStore] = useState<Store>({ tickets: SEED_DATA.tickets, logs: SEED_DATA.agentLogs });
  const [overrides, setOverrides] = useState<RoutingOverride[]>(SEED_DATA.routingOverrides);
  const [liveAi, setLiveAi] = useState(false);
  const [clockOffsetHours, setClockOffsetHours] = useState(0);
  const [nowMs, setNowMs] = useState(() => new Date(SEED_EPOCH).getTime());

  const storeRef = useRef(store);
  const offsetRef = useRef(0);
  const persistenceEnabledRef = useRef(false);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const clock = useCallback(() => new Date(Date.now() + offsetRef.current * HOUR_MS), []);

  const runSentinel = useCallback(() => {
    const now = clock();
    setNowMs(now.getTime());

    const current = storeRef.current;
    const newLogs: AgentAuditLog[] = [];
    const changedTickets: CivicTicket[] = [];

    const tickets = current.tickets.map((ticket) => {
      if (!ticket.isMaster || CLOSED_STATUSES.has(ticket.status) || ticket.sla.metAt) return ticket;
      const result = tickSla(ticket.sla, {
        referenceCode: ticket.referenceCode,
        department: ticket.assignedDepartment,
        impactCount: ticket.impactCount,
        now,
      });
      const logs = auditLogsForTick(ticket.id, result).map((log) => ({
        ...log,
        message: `${ticket.referenceCode} · ${log.message}`,
        createdAt: now.toISOString(),
      }));
      if (result.state.percentElapsed === ticket.sla.percentElapsed && logs.length === 0) return ticket;

      newLogs.push(...logs);
      const updated: CivicTicket = {
        ...ticket,
        sla: result.state,
        routingHistory: result.escalationAdvanced
          ? [
              ...ticket.routingHistory,
              {
                id: makeId(`${ticket.id}-route`),
                ticketId: ticket.id,
                fromDepartment: ticket.assignedDepartment,
                toDepartment: ticket.assignedDepartment,
                trigger: 'escalation' as const,
                reason: `SLA breached. Escalated to ${result.state.escalatedTo} with an auto-briefing.`,
                actor: 'SlaSentinel agent',
                createdAt: now.toISOString(),
              },
            ]
          : ticket.routingHistory,
        auditLog: logs.length ? [...ticket.auditLog, ...logs] : ticket.auditLog,
      };
      changedTickets.push(updated);
      return updated;
    });

    if (changedTickets.length === 0 && newLogs.length === 0) return;
    setStore({ tickets, logs: newLogs.length ? [...current.logs, ...newLogs] : current.logs });

    if (persistenceEnabledRef.current) {
      changedTickets.forEach((ticket) => persist(persistTicketAction(ticket)));
      if (newLogs.length) persist(persistAgentLogsAction(newLogs));
    }
  }, [clock]);

  useEffect(() => {
    let cancelled = false;
    loadStateAction()
      .then((state) => {
        if (cancelled) return;
        persistenceEnabledRef.current = state.persistenceEnabled;
        setStore({ tickets: state.tickets, logs: state.logs });
        setOverrides(state.overrides);
        setLiveAi(state.liveAi);
        setNowMs(Date.now());
      })
      .catch((error) => console.error('Civicloop: failed to load state', error));

    const interval = window.setInterval(runSentinel, SENTINEL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [runSentinel]);

  const submitIntake = useCallback(
    async (draft: IntakeDraft): Promise<IntakeResult> => {
      const ticketId = makeId('tkt');
      try {
        const { analysis, log: eyeLog } = await analyzeIntakeAction({
          ticketId,
          photoUrls: draft.photos.map((photo) => photo.url),
          description: draft.description,
          voiceTranscript: draft.voiceTranscript,
        });

        if (analysis.rejected && !draft.categoryOverride) {
          setStore((current) => ({ ...current, logs: [...current.logs, eyeLog] }));
          return {
            success: false,
            message: analysis.rejectionReason ?? 'CivicEye could not recognise a civic issue. Add a photo or a little more detail.',
          };
        }

        const category = draft.categoryOverride ?? analysis.category;
        const now = clock();
        const nowIso = now.toISOString();
        const dedupStartedAt = performance.now();
        const dedup = runDedupCluster({ category, location: draft.location, allTickets: storeRef.current.tickets, now });
        const dedupLog = auditLogForDedup(ticketId, dedup, Math.round(performance.now() - dedupStartedAt));
        const text = draft.description || draft.voiceTranscript || '';

        if (dedup.decision.outcome === 'merged' && dedup.masterTicket) {
          const masterId = dedup.masterTicket.id;
          if (isInvolved(dedup.masterTicket, draft.reporter.id)) {
            setStore((current) => ({ ...current, logs: [...current.logs, eyeLog, dedupLog] }));
            return {
              success: true,
              ticketId: masterId,
              message: `You're already on ${dedup.masterTicket.referenceCode} — no duplicate ticket was opened.`,
            };
          }

          const duplicateRecord: CivicTicket = {
            ...dedup.masterTicket,
            id: ticketId,
            referenceCode: nextReferenceCode(storeRef.current.tickets, now),
            title: makeTitle(category, text, draft.location),
            description: text,
            status: 'Triaged',
            location: draft.location,
            reporter: draft.reporter,
            language: draft.language,
            inputModes: draft.inputModes,
            voiceTranscript: draft.voiceTranscript,
            isMaster: false,
            masterTicketId: masterId,
            supporters: [],
            impactCount: 1,
            beforePhotos: draft.photos,
            afterPhotos: [],
            routingHistory: [],
            civicEye: analysis,
            dedup: dedup.decision,
            triage: null,
            proof: null,
            citizenConfirmation: null,
            auditLog: [eyeLog, dedupLog],
            tags: ['merged-duplicate'],
            createdAt: nowIso,
            updatedAt: nowIso,
            resolvedAt: null,
          };

          const master = storeRef.current.tickets.find((ticket) => ticket.id === masterId);
          if (!master) {
            setStore((current) => ({ ...current, logs: [...current.logs, eyeLog, dedupLog] }));
            return { success: false, message: 'That master ticket disappeared mid-submission — please try again.' };
          }
          const merged = attachSupporter(
            master,
            { reporter: draft.reporter, note: text || null, photos: draft.photos, distanceMeters: dedup.decision.candidates[0]?.distanceMeters ?? 0 },
            dedup.decision,
            dedup.escalatedSeverity,
            dedupLog,
            now,
          );
          setStore((current) => ({
            tickets: [...current.tickets.map((ticket) => (ticket.id === masterId ? merged.ticket : ticket)), duplicateRecord],
            logs: [...current.logs, eyeLog, ...merged.logs],
          }));

          if (persistenceEnabledRef.current) {
            persist(persistTicketAction(duplicateRecord));
            persist(persistTicketAction(merged.ticket));
            persist(persistSupporterAction(merged.newSupporter));
            persist(persistAgentLogsAction([eyeLog, ...merged.logs]));
          }

          return {
            success: true,
            ticketId: masterId,
            message: `Merged into ${dedup.masterTicket.referenceCode} — now reported by ${dedup.decision.impactCount} citizens.`,
          };
        }

        const { decision: triage, log: triageLog, overrides: latestOverrides } = await triageAction({
          ticketId,
          category,
          location: draft.location,
          civicEyeSuggestedSeverity: analysis.suggestedSeverity,
          hazardIndicators: analysis.hazardIndicators,
          dedupUrgencyEscalations: 0,
          dedupImpactCount: 1,
        });
        setOverrides(latestOverrides);

        const createdAt = clock();
        const createdIso = createdAt.toISOString();
        const referenceCode = nextReferenceCode(storeRef.current.tickets, createdAt);
        const ticket: CivicTicket = {
          id: ticketId,
          referenceCode,
          title: makeTitle(category, text, draft.location),
          description: text || `${category} reported with photo evidence.`,
          category,
          status: 'Assigned',
          severity: triage.severity,
          location: draft.location,
          reporter: draft.reporter,
          language: draft.language,
          inputModes: draft.inputModes,
          voiceTranscript: draft.voiceTranscript,
          isMaster: true,
          masterTicketId: null,
          supporters: [],
          impactCount: 1,
          beforePhotos: draft.photos,
          afterPhotos: [],
          assignedDepartment: triage.department,
          assignedOfficer: null,
          routingHistory: [
            {
              id: makeId(`${ticketId}-route`),
              ticketId,
              fromDepartment: null,
              toDepartment: triage.department,
              trigger: triage.appliedOverrideId ? 'self-healing' : 'initial-triage',
              reason: triage.rationale,
              actor: 'TriageRouting agent',
              createdAt: createdIso,
            },
          ],
          civicEye: analysis,
          dedup: dedup.decision,
          triage,
          sla: startSlaClock(triage.severity, createdIso),
          proof: null,
          citizenConfirmation: null,
          auditLog: [eyeLog, dedupLog, triageLog],
          tags: triage.appliedOverrideId ? ['self-healing'] : [],
          createdAt: createdIso,
          updatedAt: createdIso,
          resolvedAt: null,
        };

        setStore((current) => ({
          tickets: [ticket, ...current.tickets],
          logs: [...current.logs, eyeLog, dedupLog, triageLog],
        }));

        if (persistenceEnabledRef.current) {
          persist(persistTicketAction(ticket));
          persist(persistRoutingEventAction(ticket.routingHistory[0]));
          persist(persistAgentLogsAction([eyeLog, dedupLog, triageLog]));
        }

        return {
          success: true,
          ticketId,
          message: triage.appliedOverrideId
            ? `Filed as ${referenceCode}. Self-healing routing sent it straight to ${triage.department}.`
            : `Filed as ${referenceCode} and routed to ${triage.department} (${triage.slaHours} h SLA).`,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'The agent pipeline could not process this report. Please try again.',
        };
      }
    },
    [clock],
  );

  const supportTicket = useCallback(
    (ticketId: string, reporter: PublicReporter, note: string | null, reporterLocation: GeoPoint | null) => {
      const now = clock();
      const master = storeRef.current.tickets.find((ticket) => ticket.id === ticketId);
      if (!master || isInvolved(master, reporter.id)) return;

      const dedup = runDedupCluster({ category: master.category, location: master.location, allTickets: [master], now });
      const dedupLog = auditLogForDedup(makeId('support'), dedup, 0);
      const merged = attachSupporter(
        master,
        { reporter, note, photos: [], distanceMeters: reporterLocation ? Math.round(haversineMeters(reporterLocation, master.location)) : 0 },
        dedup.decision,
        dedup.escalatedSeverity,
        dedupLog,
        now,
      );
      setStore((current) => ({
        tickets: current.tickets.map((ticket) => (ticket.id === ticketId ? merged.ticket : ticket)),
        logs: [...current.logs, ...merged.logs],
      }));

      if (persistenceEnabledRef.current) {
        persist(persistTicketAction(merged.ticket));
        persist(persistSupporterAction(merged.newSupporter));
        persist(persistAgentLogsAction(merged.logs));
      }
    },
    [clock],
  );

  const confirmResolution = useCallback(
    (ticketId: string, input: CitizenConfirmationInput, confirmedBy: string) => {
      const now = clock();
      const nowIso = now.toISOString();
      const ticket = storeRef.current.tickets.find((entry) => entry.id === ticketId);
      if (!ticket) return;

      const approved = input.decision === 'approved';
      const log = agentLog(
        ticketId,
        'CivicProof',
        approved ? 'citizen.approve' : 'citizen.reject',
        approved
          ? `${ticket.referenceCode} closed — citizen confirmed the fix${input.rating ? ` (${input.rating}★)` : ''}.`
          : `${ticket.referenceCode} reopened — citizen says it is not fixed. SLA clock resumed.`,
        approved ? 'success' : 'warning',
        { decision: input.decision, rating: input.rating },
        now,
      );
      const reopenedSla = tickSla(
        { ...ticket.sla, metAt: null },
        { referenceCode: ticket.referenceCode, department: ticket.assignedDepartment, impactCount: ticket.impactCount, now },
      ).state;
      const updated: CivicTicket = {
        ...ticket,
        status: approved ? 'Resolved' : 'Reopened',
        resolvedAt: approved ? nowIso : null,
        sla: approved ? (ticket.sla.metAt ? ticket.sla : markSlaResolved(ticket.sla, nowIso)) : reopenedSla,
        citizenConfirmation: { ...input, confirmedBy, confirmedAt: nowIso },
        updatedAt: nowIso,
        auditLog: [...ticket.auditLog, log],
      };
      setStore((current) => ({
        tickets: current.tickets.map((entry) => (entry.id === ticketId ? updated : entry)),
        logs: [...current.logs, log],
      }));

      if (persistenceEnabledRef.current) {
        persist(persistTicketAction(updated));
        persist(persistAgentLogsAction([log]));
      }
    },
    [clock],
  );

  const startWork = useCallback(
    (ticketId: string, officerId: string) => {
      const nowIso = clock().toISOString();
      const ticket = storeRef.current.tickets.find((entry) => entry.id === ticketId);
      if (!ticket) return;

      const updated: CivicTicket = { ...ticket, status: 'In Progress', assignedOfficer: officerId, updatedAt: nowIso };
      setStore((current) => ({
        ...current,
        tickets: current.tickets.map((entry) => (entry.id === ticketId ? updated : entry)),
      }));

      if (persistenceEnabledRef.current) persist(persistTicketAction(updated));
    },
    [clock],
  );

  const rerouteTicket = useCallback(
    async (ticketId: string, toDepartment: Department, reason: string, authority: AuthorityProfile) => {
      const ticket = storeRef.current.tickets.find((entry) => entry.id === ticketId);
      if (!ticket) throw new Error('Ticket not found.');

      const { log, overrides: latestOverrides } = await recordRerouteAction({
        ticketId,
        category: ticket.category,
        location: ticket.location,
        fromDepartment: ticket.assignedDepartment,
        toDepartment,
        reason,
        correctedBy: `${authority.designation}, ${authority.zone}`,
      });
      setOverrides(latestOverrides);

      const nowIso = clock().toISOString();
      const routingEvent = {
        id: makeId(`${ticketId}-route`),
        ticketId,
        fromDepartment: ticket.assignedDepartment,
        toDepartment,
        trigger: 'authority-reroute' as const,
        reason,
        actor: `${authority.name} (${authority.officialId})`,
        createdAt: nowIso,
      };
      const updated: CivicTicket = {
        ...ticket,
        assignedDepartment: toDepartment,
        assignedOfficer: null,
        status: 'Assigned',
        triage: ticket.triage ? { ...ticket.triage, department: toDepartment } : ticket.triage,
        routingHistory: [...ticket.routingHistory, routingEvent],
        tags: Array.from(new Set([...ticket.tags, 'rerouted'])),
        updatedAt: nowIso,
        auditLog: [...ticket.auditLog, log],
      };
      setStore((current) => ({
        tickets: current.tickets.map((entry) => (entry.id === ticketId ? updated : entry)),
        logs: [...current.logs, log],
      }));

      if (persistenceEnabledRef.current) {
        persist(persistTicketAction(updated));
        persist(persistRoutingEventAction(routingEvent));
        persist(persistAgentLogsAction([log]));
      }
    },
    [clock],
  );

  const submitProof = useCallback(
    async (ticketId: string, afterPhoto: EvidencePhoto, authority: AuthorityProfile): Promise<CivicProofVerification> => {
      const ticket = storeRef.current.tickets.find((entry) => entry.id === ticketId);
      if (!ticket) throw new Error('Ticket not found.');
      const previousStatus = ticket.status;

      setStore((current) => ({
        ...current,
        tickets: current.tickets.map((entry) =>
          entry.id === ticketId ? { ...entry, status: 'Proof Submitted', afterPhotos: [...entry.afterPhotos, afterPhoto] } : entry,
        ),
      }));

      try {
        const { verification, log } = await verifyProofAction({
          ticketId,
          beforePhoto: ticket.beforePhotos[0] ?? null,
          afterPhoto,
          submittedBy: authority.officialId,
        });
        const nowIso = clock().toISOString();
        // Rejected proof keeps the ticket open; verified or human-review proof hands it to the citizen.
        const handedToCitizen = verification.verdict !== 'rejected';
        const updated: CivicTicket = {
          ...ticket,
          status: handedToCitizen ? 'Pending Citizen Confirmation' : 'In Progress',
          afterPhotos: [...ticket.afterPhotos, afterPhoto],
          proof: verification,
          sla: handedToCitizen && !ticket.sla.metAt ? markSlaResolved(ticket.sla, nowIso) : ticket.sla,
          tags: verification.verdict === 'rejected' ? Array.from(new Set([...ticket.tags, 'proof-rejected'])) : ticket.tags,
          updatedAt: nowIso,
          auditLog: [...ticket.auditLog, log],
        };

        setStore((current) => ({
          tickets: current.tickets.map((entry) => (entry.id === ticketId ? updated : entry)),
          logs: [...current.logs, log],
        }));

        if (persistenceEnabledRef.current) {
          persist(persistTicketAction(updated));
          persist(persistAgentLogsAction([log]));
        }
        return verification;
      } catch (error) {
        setStore((current) => ({
          ...current,
          tickets: current.tickets.map((entry) =>
            entry.id === ticketId
              ? { ...entry, status: previousStatus, afterPhotos: entry.afterPhotos.filter((photo) => photo.id !== afterPhoto.id) }
              : entry,
          ),
        }));
        throw error;
      }
    },
    [clock],
  );

  const fastForward = useCallback(
    (hours: number) => {
      offsetRef.current += hours;
      setClockOffsetHours(offsetRef.current);
      runSentinel();
    },
    [runSentinel],
  );

  const resetDemo = useCallback(async () => {
    offsetRef.current = 0;
    setClockOffsetHours(0);
    try {
      const state = await resetDemoAction();
      persistenceEnabledRef.current = state.persistenceEnabled;
      setStore({ tickets: state.tickets, logs: state.logs });
      setOverrides(state.overrides);
      setLiveAi(state.liveAi);
    } catch (error) {
      console.error('Civicloop: reset failed', error);
      setStore({ tickets: SEED_DATA.tickets, logs: SEED_DATA.agentLogs });
      setOverrides(SEED_DATA.routingOverrides);
    }
    setNowMs(Date.now());
  }, []);

  return {
    tickets: store.tickets,
    logs: store.logs,
    overrides,
    liveAi,
    nowMs,
    clockOffsetHours,
    submitIntake,
    supportTicket,
    confirmResolution,
    startWork,
    rerouteTicket,
    submitProof,
    fastForward,
    resetDemo,
  };
}
