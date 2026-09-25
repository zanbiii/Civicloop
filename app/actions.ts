'use server';

/**
 * Server Actions for the agent pipeline. Everything that talks to Mistral
 * runs here so `MISTRAL_API_KEY` never reaches the browser, and the
 * self-healing routing graph lives in one server-side place that every
 * client sees. Inputs are re-validated because an action is a public POST
 * endpoint, whatever the UI does.
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
import { SEED_ROUTING_OVERRIDES } from '@/lib/seedData';
import {
  isComplaintCategory,
  isDepartment,
  isSeverity,
  type AgentAuditLog,
  type CivicEyeAnalysis,
  type CivicProofVerification,
  type ComplaintCategory,
  type Department,
  type EvidencePhoto,
  type GeoPoint,
  type RoutingOverride,
  type Severity,
  type TriageDecision,
} from '@/types/civic';

const MAX_PHOTOS = 4;
const MAX_TEXT = 4_000;

let graphHydrated = false;

function ensureGraphHydrated(): void {
  if (graphHydrated) return;
  hydrateRoutingOverrides(SEED_ROUTING_OVERRIDES);
  graphHydrated = true;
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

export async function getAgentStatusAction(): Promise<{ liveAi: boolean; overrides: RoutingOverride[] }> {
  ensureGraphHydrated();
  return { liveAi: isMistralLive(), overrides: listRoutingOverrides() };
}

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
  ensureGraphHydrated();

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
  return {
    decision,
    log: auditLogForTriage(cleanText(input.ticketId, 120), decision, Date.now() - startedAt),
    overrides: listRoutingOverrides(),
  };
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
  ensureGraphHydrated();

  const override = recordWrongDepartmentCorrection({
    category: input.category,
    location: cleanGeo(input.location),
    fromDepartment: input.fromDepartment,
    toDepartment: input.toDepartment,
    reason: cleanText(input.reason, 500) || 'Wrong department flagged by authority.',
    correctedBy: cleanText(input.correctedBy, 120) || 'Authority',
  });
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
    submittedBy: cleanText(input.submittedBy, 120) || 'Authority',
  });
  return { verification, log: auditLogForProof(cleanText(input.ticketId, 120), verification, Date.now() - startedAt) };
}

export async function resetRoutingGraphAction(): Promise<RoutingOverride[]> {
  hydrateRoutingOverrides(SEED_ROUTING_OVERRIDES);
  graphHydrated = true;
  return listRoutingOverrides();
}
