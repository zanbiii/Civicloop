'use server';

/**
 * Server Actions for the agent pipeline and persistence. Everything that
 * talks to Mistral or Supabase runs here so neither `MISTRAL_API_KEY` nor
 * `SUPABASE_SERVICE_ROLE_KEY` ever reaches the browser, and the self-healing
 * routing graph lives in one server-side place every client sees. Inputs are
 * re-validated because an action is a public POST endpoint, whatever the UI
 * does.
 *
 * Persistence is optional and additive: when Supabase isn't configured,
 * `loadStateAction`/`resetDemoAction` fall back to an in-memory seed and the
 * `persist*` actions are harmless no-ops, so the app runs exactly as it did
 * before Supabase existed.
 */

import { analyzeIntake, auditLogForCivicEye } from '@/lib/agents/civicEyeAgent';
import {
  auditLogForCorrection,
  auditLogForTriage,
  hydrateRoutingOverrides,
  listRoutingOverrides,
  recordWrongDepartmentCorrection,
  runTriage,
} from '@/lib/agents/triageRoutingAgent';
import { auditLogForProof, verifyProof } from '@/lib/agents/civicProofAgent';
import { isMistralLive } from '@/lib/mistralClient';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as repo from '@/lib/supabase/repo';
import { SEED_ROUTING_OVERRIDES, buildSeedData } from '@/lib/seedData';
import {
  isComplaintCategory,
  isDepartment,
  isSeverity,
  type AgentAuditLog,
  type CivicEyeAnalysis,
  type CivicProofVerification,
  type CivicTicket,
  type ComplaintCategory,
  type Department,
  type EvidencePhoto,
  type GeoPoint,
  type RoutingEvent,
  type RoutingOverride,
  type Severity,
  type TicketSupporter,
  type TriageDecision,
} from '@/types/civic';

const MAX_PHOTOS = 4;
const MAX_TEXT = 4_000;

let graphHydrated = false;

async function ensureGraphHydrated(): Promise<void> {
  if (graphHydrated) return;
  graphHydrated = true;
  if (isSupabaseConfigured()) {
    try {
      hydrateRoutingOverrides(await repo.listRoutingOverrides());
      return;
    } catch {
      // DB unreachable — fall through to the static seed so triage still works.
    }
  }
  hydrateRoutingOverrides(SEED_ROUTING_OVERRIDES);
}

function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isImageUrl(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('https://'));
}

function cleanGeo(value: GeoPoint): GeoPoint {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Invalid location.');
  }
  return {
    lat,
    lng,
    accuracyMeters: Number.isFinite(value.accuracyMeters) ? value.accuracyMeters : undefined,
    address: value.address ? cleanText(value.address, 300) : undefined,
    ward: value.ward ? cleanText(value.ward, 80) : undefined,
    zone: value.zone ? cleanText(value.zone, 80) : undefined,
  };
}

function cleanPhoto(photo: EvidencePhoto | null): EvidencePhoto | null {
  if (!photo || !isImageUrl(photo.url)) return null;
  return {
    id: cleanText(photo.id, 120),
    kind: photo.kind === 'after' ? 'after' : 'before',
    url: photo.url,
    source: photo.source === 'camera' || photo.source === 'upload' ? photo.source : 'seed',
    capturedAt: cleanText(photo.capturedAt, 40),
    capturedBy: cleanText(photo.capturedBy, 120),
    geo: photo.geo ? cleanGeo(photo.geo) : null,
    caption: photo.caption ? cleanText(photo.caption, 300) : null,
  };
}

/* ------------------------------------------------------------------------- */
/* State loading & persistence                                               */
/* ------------------------------------------------------------------------- */

export interface CivicState {
  tickets: CivicTicket[];
  overrides: RoutingOverride[];
  logs: AgentAuditLog[];
  liveAi: boolean;
  persistenceEnabled: boolean;
}

/** Called once at mount. Seeds Supabase on first run; falls back to an in-memory seed when unconfigured. */
export async function loadStateAction(): Promise<CivicState> {
  const liveAi = isMistralLive();

  if (isSupabaseConfigured()) {
    try {
      if (await repo.isEmpty()) {
        const seed = buildSeedData(new Date());
        await repo.seedAll(seed);
      }
      const [tickets, overrides, logs] = await Promise.all([
        repo.listTickets(),
        repo.listRoutingOverrides(),
        repo.listAgentLogs(),
      ]);
      hydrateRoutingOverrides(overrides);
      graphHydrated = true;
      return { tickets, overrides, logs, liveAi, persistenceEnabled: true };
    } catch (error) {
      console.error('Supabase load failed, falling back to in-memory seed:', error);
    }
  }

  const seed = buildSeedData(new Date());
  hydrateRoutingOverrides(seed.routingOverrides);
  graphHydrated = true;
  return { tickets: seed.tickets, overrides: seed.routingOverrides, logs: seed.agentLogs, liveAi, persistenceEnabled: false };
}

/** Wipes and reseeds Supabase; when unconfigured, just hands back a fresh in-memory seed. */
export async function resetDemoAction(): Promise<CivicState> {
  const liveAi = isMistralLive();

  if (isSupabaseConfigured()) {
    try {
      await repo.resetAll();
      const seed = buildSeedData(new Date());
      await repo.seedAll(seed);
      const [tickets, overrides, logs] = await Promise.all([
        repo.listTickets(),
        repo.listRoutingOverrides(),
        repo.listAgentLogs(),
      ]);
      hydrateRoutingOverrides(overrides);
      return { tickets, overrides, logs, liveAi, persistenceEnabled: true };
    } catch (error) {
      console.error('Supabase reset failed, falling back to in-memory seed:', error);
    }
  }

  const seed = buildSeedData(new Date());
  hydrateRoutingOverrides(seed.routingOverrides);
  return { tickets: seed.tickets, overrides: seed.routingOverrides, logs: seed.agentLogs, liveAi, persistenceEnabled: false };
}

/** Fire-and-forget durability write for one ticket. No-ops when Supabase isn't configured. */
export async function persistTicketAction(ticket: CivicTicket): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await repo.upsertTicket(ticket);
}

export async function persistSupporterAction(supporter: TicketSupporter): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await repo.insertSupporter(supporter);
}

export async function persistRoutingEventAction(event: RoutingEvent): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await repo.insertRoutingEvent(event);
}

export async function persistRoutingOverrideAction(override: RoutingOverride): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await repo.upsertRoutingOverride(override);
}

export async function persistAgentLogsAction(logs: AgentAuditLog[]): Promise<void> {
  if (!isSupabaseConfigured() || logs.length === 0) return;
  await repo.insertAgentLogs(logs);
}

/* ------------------------------------------------------------------------- */
/* Agent pipeline                                                            */
/* ------------------------------------------------------------------------- */

export async function analyzeIntakeAction(input: {
  ticketId: string;
  photoUrls: string[];
  description: string;
  voiceTranscript: string | null;
}): Promise<{ analysis: CivicEyeAnalysis; log: AgentAuditLog }> {
  const startedAt = Date.now();
  const analysis = await analyzeIntake({
    photoUrls: (Array.isArray(input.photoUrls) ? input.photoUrls : []).filter(isImageUrl).slice(0, MAX_PHOTOS),
    description: cleanText(input.description),
    voiceTranscript: input.voiceTranscript ? cleanText(input.voiceTranscript) : null,
  });
  return { analysis, log: auditLogForCivicEye(cleanText(input.ticketId, 120), analysis, Date.now() - startedAt) };
}

export async function triageAction(input: {
  ticketId: string;
  category: ComplaintCategory;
  location: GeoPoint;
  civicEyeSuggestedSeverity: Severity;
  hazardIndicators: string[];
  dedupUrgencyEscalations: number;
  dedupImpactCount: number;
}): Promise<{ decision: TriageDecision; log: AgentAuditLog; overrides: RoutingOverride[] }> {
  if (!isComplaintCategory(input.category)) throw new Error('Unknown category.');
  if (!isSeverity(input.civicEyeSuggestedSeverity)) throw new Error('Unknown severity.');
  await ensureGraphHydrated();

  const startedAt = Date.now();
  const decision = await runTriage({
    category: input.category,
    location: cleanGeo(input.location),
    civicEyeSuggestedSeverity: input.civicEyeSuggestedSeverity,
    hazardIndicators: (Array.isArray(input.hazardIndicators) ? input.hazardIndicators : [])
      .map((signal) => cleanText(signal, 200))
      .slice(0, 12),
    dedupUrgencyEscalations: Math.max(0, Math.min(4, Math.floor(Number(input.dedupUrgencyEscalations) || 0))),
    dedupImpactCount: Math.max(1, Math.floor(Number(input.dedupImpactCount) || 1)),
  });

  const overrides = listRoutingOverrides();
  if (decision.appliedOverrideId && isSupabaseConfigured()) {
    const applied = overrides.find((override) => override.id === decision.appliedOverrideId);
    if (applied) await repo.upsertRoutingOverride(applied).catch((error) => console.error('Persist override failed:', error));
  }

  return { decision, log: auditLogForTriage(cleanText(input.ticketId, 120), decision, Date.now() - startedAt), overrides };
}

export async function recordRerouteAction(input: {
  ticketId: string;
  category: ComplaintCategory;
  location: GeoPoint;
  fromDepartment: Department;
  toDepartment: Department;
  reason: string;
  correctedBy: string;
}): Promise<{ override: RoutingOverride; log: AgentAuditLog; overrides: RoutingOverride[] }> {
  if (!isComplaintCategory(input.category)) throw new Error('Unknown category.');
  if (!isDepartment(input.fromDepartment) || !isDepartment(input.toDepartment)) throw new Error('Unknown department.');
  if (input.fromDepartment === input.toDepartment) throw new Error('Pick a different department to re-route to.');
  await ensureGraphHydrated();

  const override = recordWrongDepartmentCorrection({
    category: input.category,
    location: cleanGeo(input.location),
    fromDepartment: input.fromDepartment,
    toDepartment: input.toDepartment,
    reason: cleanText(input.reason, 500) || 'Wrong department flagged by CoV.',
    correctedBy: cleanText(input.correctedBy, 120) || 'CoV',
  });

  if (isSupabaseConfigured()) await repo.upsertRoutingOverride(override);

  return {
    override,
    log: auditLogForCorrection(cleanText(input.ticketId, 120), override),
    overrides: listRoutingOverrides(),
  };
}

export async function verifyProofAction(input: {
  ticketId: string;
  beforePhoto: EvidencePhoto | null;
  afterPhoto: EvidencePhoto;
  submittedBy: string;
}): Promise<{ verification: CivicProofVerification; log: AgentAuditLog }> {
  const afterPhoto = cleanPhoto(input.afterPhoto);
  if (!afterPhoto) throw new Error('An "after" photo is required to close a ticket.');

  const startedAt = Date.now();
  const verification = await verifyProof({
    beforePhoto: cleanPhoto(input.beforePhoto),
    afterPhoto,
    submittedBy: cleanText(input.submittedBy, 120) || 'CoV',
  });
  return { verification, log: auditLogForProof(cleanText(input.ticketId, 120), verification, Date.now() - startedAt) };
}
