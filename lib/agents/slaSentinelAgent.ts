/**
 * Agent 4 — SLA Sentinel & Escalation.
 *
 * Owns the SLA countdown for every ticket: computes percent-elapsed against
 * the severity's contractual window, fires a one-time 75% warning, and on a
 * breach auto-escalates to the department's zonal escalation contact (climbing to the
 * Commissioner's office the longer it stays breached) with a generated
 * briefing — all without waiting on a human to notice.
 */

import { DEPARTMENT_META, SLA_HOURS, type AgentAuditLog, type Department, type Severity, type SlaState } from '@/types/civic';

const HOUR_MS = 3_600_000;
const WARNING_THRESHOLD_PERCENT = 75;

export function startSlaClock(severity: Severity, startedAtIso: string): SlaState {
  const slaHours = SLA_HOURS[severity];
  return {
    severity,
    slaHours,
    startedAt: startedAtIso,
    dueAt: new Date(new Date(startedAtIso).getTime() + slaHours * HOUR_MS).toISOString(),
    percentElapsed: 0,
    health: 'on_track',
    warnedAt: null,
    breachedAt: null,
    escalationLevel: 0,
    escalatedTo: null,
    escalationBriefing: null,
    metAt: null,
  };
}

export interface SlaTickContext {
  referenceCode: string;
  department: Department;
  impactCount: number;
  now?: Date;
}

export interface SlaTickResult {
  state: SlaState;
  warningFired: boolean;
  breachFired: boolean;
  escalationAdvanced: boolean;
}

/** Escalation contact for a given breach depth: ward level, then the department's zonal contact, then the Commissioner. */
function escalationTargetFor(department: Department, level: 1 | 2 | 3): string {
  if (level >= 3) return 'Municipal Commissioner — BBMP';
  if (level === 2) return DEPARTMENT_META[department].escalationContact;
  return `${DEPARTMENT_META[department].escalationContact} (ward level)`;
}

function buildBriefing(
  context: SlaTickContext,
  slaHours: number,
  severity: Severity,
  percentElapsed: number,
  escalatedTo: string,
): string {
  return (
    `AUTO-BRIEFING — ${context.referenceCode} breached its ${slaHours} h ${severity} window ` +
    `(${percentElapsed}% elapsed). ${context.impactCount} citizen(s) attached. ` +
    `Escalated to ${escalatedTo} for immediate action.`
  );
}

/**
 * Recomputes an SLA state against the wall clock. Pure and idempotent, so a
 * sentinel sweep can call this on every ticket every tick without side effects.
 */
export function tickSla(current: SlaState, context: SlaTickContext): SlaTickResult {
  if (current.metAt) {
    return { state: current, warningFired: false, breachFired: false, escalationAdvanced: false };
  }

  const now = context.now ?? new Date();
  const startedAt = new Date(current.startedAt).getTime();
  const windowMs = current.slaHours * HOUR_MS;
  const percentElapsed = Math.max(0, Math.round(((now.getTime() - startedAt) / windowMs) * 100));

  let health: SlaState['health'] = 'on_track';
  let warnedAt = current.warnedAt;
  let breachedAt = current.breachedAt;
  let escalationLevel = current.escalationLevel;
  let escalatedTo = current.escalatedTo;
  let escalationBriefing = current.escalationBriefing;

  let warningFired = false;
  let breachFired = false;
  let escalationAdvanced = false;

  if (percentElapsed >= WARNING_THRESHOLD_PERCENT && !warnedAt) {
    warnedAt = now.toISOString();
    warningFired = true;
  }

  if (percentElapsed >= 100) {
    health = 'breached';
    if (!breachedAt) {
      breachedAt = current.dueAt;
      breachFired = true;
    }
    // Every full extra SLA window past the deadline climbs one more escalation rung, capped at 3.
    const targetLevel = Math.min(3, 1 + Math.floor(Math.max(0, percentElapsed - 100) / 100)) as 1 | 2 | 3;
    if (targetLevel > escalationLevel) {
      escalationLevel = targetLevel;
      escalatedTo = escalationTargetFor(context.department, targetLevel);
      escalationBriefing = buildBriefing(context, current.slaHours, current.severity, percentElapsed, escalatedTo);
      escalationAdvanced = true;
    }
  } else if (percentElapsed >= WARNING_THRESHOLD_PERCENT) {
    health = 'warning';
  }

  return {
    state: { ...current, percentElapsed, health, warnedAt, breachedAt, escalationLevel, escalatedTo, escalationBriefing },
    warningFired,
    breachFired,
    escalationAdvanced,
  };
}

/** Stops the clock. A late closure stays `breached` rather than retroactively becoming `met`. */
export function markSlaResolved(state: SlaState, resolvedAtIso: string): SlaState {
  const alreadyBreached = state.health === 'breached';
  return { ...state, health: alreadyBreached ? 'breached' : 'met', metAt: resolvedAtIso };
}

export function auditLogsForTick(ticketId: string, result: SlaTickResult): AgentAuditLog[] {
  const logs: AgentAuditLog[] = [];
  const now = new Date().toISOString();

  if (result.warningFired) {
    logs.push({
      id: `log-sla-warn-${ticketId}-${Date.now()}`,
      ticketId,
      agent: 'SlaSentinel',
      action: 'sla.warn',
      message: `Ticket has consumed ${result.state.percentElapsed}% of its ${result.state.slaHours} h ${result.state.severity} window.`,
      level: 'warning',
      payload: { percentElapsed: result.state.percentElapsed, severity: result.state.severity },
      confidence: null,
      latencyMs: 0,
      mode: 'live',
      createdAt: result.state.warnedAt ?? now,
    });
  }

  if (result.escalationAdvanced) {
    logs.push({
      id: `log-sla-escalate-${ticketId}-${Date.now()}`,
      ticketId,
      agent: 'SlaSentinel',
      action: 'sla.escalate',
      message: `SLA breached. Auto-escalated to ${result.state.escalatedTo}.`,
      level: 'error',
      payload: {
        escalationLevel: result.state.escalationLevel,
        escalatedTo: result.state.escalatedTo,
        percentElapsed: result.state.percentElapsed,
      },
      confidence: null,
      latencyMs: 0,
      mode: 'live',
      createdAt: now,
    });
  }

  return logs;
}
