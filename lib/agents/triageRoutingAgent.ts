/**
 * Agent 3 — Smart Triage & Self-Healing Routing.
 *
 * Maps category + location to the correct department, computes severity and
 * the SLA window, and holds the self-healing routing graph: when an
 * CoV flags "Wrong Department", the correction is written here as a
 * learned override so later reports of the same category in the same zone
 * route correctly on the very first hop — no human has to catch it twice.
 */

import {
  CATEGORY_META,
  SLA_HOURS,
  compareSeverity,
  escalateSeverity,
  type AgentAuditLog,
  type AgentRunMode,
  type ComplaintCategory,
  type Department,
  type GeoPoint,
  type RoutingOverride,
  type Severity,
  type TriageDecision,
} from '@/types/civic';
import { zoneKeyFor } from '@/lib/haversine';
import { REASONING_MODEL, callReasoningJson } from '@/lib/mistralClient';

/** Overrides at or above this learned weight rewrite routing on the very next ticket. */
const OVERRIDE_ACTIVATION_WEIGHT = 0.55;
const OVERRIDE_CONFIDENCE = 90;

/**
 * In-memory self-healing routing graph, keyed by "category|zoneKey". Lives
 * for the process lifetime, which is enough to demo the feedback loop live —
 * a production deployment would back this with the `routing_overrides` table.
 */
const overrideGraph = new Map<string, RoutingOverride>();

function overrideKey(category: ComplaintCategory, zoneKey: string): string {
  return `${category}|${zoneKey}`;
}

/** Replaces the live graph with the given corrections — used at boot (seed data) and on demo reset. */
export function hydrateRoutingOverrides(overrides: RoutingOverride[]): void {
  overrideGraph.clear();
  overrides.forEach((override) => overrideGraph.set(overrideKey(override.category, override.zoneKey), override));
}

export function listRoutingOverrides(): RoutingOverride[] {
  return Array.from(overrideGraph.values());
}

function activeOverrideFor(category: ComplaintCategory, zoneKey: string): RoutingOverride | null {
  const override = overrideGraph.get(overrideKey(category, zoneKey));
  return override && override.weight >= OVERRIDE_ACTIVATION_WEIGHT ? override : null;
}

/** Called when a CoV flags "Wrong Department" and redirects a ticket. */
export function recordWrongDepartmentCorrection(input: {
  category: ComplaintCategory;
  location: GeoPoint;
  fromDepartment: Department;
  toDepartment: Department;
  reason: string;
  correctedBy: string;
  now?: Date;
}): RoutingOverride {
  const zoneKey = zoneKeyFor(input.location);
  const key = overrideKey(input.category, zoneKey);
  const now = input.now ?? new Date();
  const existing = overrideGraph.get(key);

  const occurrences = (existing?.occurrences ?? 0) + 1;
  // A single CoV correction already clears the activation threshold; each repeat reinforces it.
  const weight = Math.min(0.97, 0.45 + occurrences * 0.15);
  const slug = `${zoneKey}-${input.category}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const override: RoutingOverride = {
    id: existing?.id ?? `override-${slug}`,
    category: input.category,
    zoneKey,
    centroid: input.location,
    radiusMeters: existing?.radiusMeters ?? 900,
    fromDepartment: input.fromDepartment,
    toDepartment: input.toDepartment,
    occurrences,
    weight,
    reason: input.reason,
    correctedBy: input.correctedBy,
    createdAt: existing?.createdAt ?? now.toISOString(),
    lastAppliedAt: existing?.lastAppliedAt ?? null,
    autoCorrectedCount: existing?.autoCorrectedCount ?? 0,
  };

  overrideGraph.set(key, override);
  return override;
}

/** Marks that a learned override auto-corrected a later ticket before a human saw it. */
function markOverrideAutoApplied(overrideId: string, now: Date): void {
  for (const [key, override] of overrideGraph) {
    if (override.id === overrideId) {
      overrideGraph.set(key, {
        ...override,
        autoCorrectedCount: override.autoCorrectedCount + 1,
        lastAppliedAt: now.toISOString(),
      });
      return;
    }
  }
}

function mostUrgent(a: Severity, b: Severity): Severity {
  return compareSeverity(a, b) >= 0 ? a : b;
}

export interface TriageInput {
  category: ComplaintCategory;
  location: GeoPoint;
  civicEyeSuggestedSeverity: Severity;
  hazardIndicators: string[];
  dedupUrgencyEscalations: number;
  dedupImpactCount: number;
  now?: Date;
}

function buildRationale(department: Department, override: RoutingOverride | null, dedupEscalations: number): string {
  if (override) {
    return (
      `Self-healing override active for this zone: ${override.category} reports here now route straight to ` +
      `${department} (learned from ${override.occurrences} CoV correction(s), auto-corrected ` +
      `${override.autoCorrectedCount} earlier ticket(s)).`
    );
  }
  const bumped = dedupEscalations > 0 ? ` Severity raised on crowd corroboration (${dedupEscalations} escalation step(s)).` : '';
  return `${department} is the default jurisdiction for this category.${bumped}`;
}

export async function runTriage(input: TriageInput): Promise<TriageDecision> {
  const now = input.now ?? new Date();
  const zoneKey = zoneKeyFor(input.location);
  const meta = CATEGORY_META[input.category];
  const override = activeOverrideFor(input.category, zoneKey);

  const department = override?.toDepartment ?? meta.defaultDepartment;
  const baseSeverity = mostUrgent(meta.baseSeverity, input.civicEyeSuggestedSeverity);
  const severity = input.dedupUrgencyEscalations > 0 ? escalateSeverity(baseSeverity, input.dedupUrgencyEscalations) : baseSeverity;

  if (override) {
    markOverrideAutoApplied(override.id, now);
  }

  const severitySignals = [
    ...input.hazardIndicators,
    ...(input.dedupUrgencyEscalations > 0 ? [`Impact counter at ${input.dedupImpactCount} citizens`] : []),
  ];

  let rationale = buildRationale(department, override, input.dedupUrgencyEscalations);
  let mode: AgentRunMode = 'mock';

  if (!override) {
    const enrichment = await callReasoningJson({
      systemPrompt:
        'You are the Smart Triage agent for Civicloop, a civic-complaint platform in Bangalore. Given a ' +
        'complaint category, department and severity signals, write ONE short, concrete sentence explaining ' +
        'the routing decision to a city official. Respond with ONLY JSON: {"rationale": "<sentence>"}',
      userPrompt: `Category: ${input.category}. Department: ${department}. Severity: ${severity}. Signals: ${
        severitySignals.join('; ') || 'none'
      }.`,
    });

    if (typeof enrichment.json?.rationale === 'string' && enrichment.json.rationale.trim().length > 0) {
      rationale = enrichment.json.rationale.trim();
      mode = enrichment.mode;
    }
  }

  return {
    department,
    severity,
    slaHours: SLA_HOURS[severity],
    routingConfidence: override ? OVERRIDE_CONFIDENCE : 80 + Math.min(15, severitySignals.length * 3),
    rationale,
    severitySignals,
    appliedOverrideId: override?.id ?? null,
    zoneKey,
    model: REASONING_MODEL,
    mode,
    decidedAt: now.toISOString(),
  };
}

export function auditLogForTriage(ticketId: string, decision: TriageDecision, latencyMs: number): AgentAuditLog {
  return {
    id: `log-triage-${ticketId}-${Date.now()}`,
    ticketId,
    agent: 'TriageRouting',
    action: decision.appliedOverrideId ? 'selfheal.apply' : 'route.assign',
    message: decision.rationale,
    level: decision.appliedOverrideId ? 'success' : 'info',
    payload: {
      department: decision.department,
      severity: decision.severity,
      slaHours: decision.slaHours,
      appliedOverrideId: decision.appliedOverrideId,
    },
    confidence: decision.routingConfidence,
    latencyMs,
    mode: decision.mode,
    createdAt: decision.decidedAt,
  };
}

export function auditLogForCorrection(ticketId: string, override: RoutingOverride): AgentAuditLog {
  return {
    id: `log-selfheal-learn-${override.id}-${Date.now()}`,
    ticketId,
    agent: 'TriageRouting',
    action: 'selfheal.learn',
    message:
      `CoV flagged Wrong Department. Correction written to the routing graph: ` +
      `${override.fromDepartment} → ${override.toDepartment} for ${override.category} in ${override.zoneKey}.`,
    level: 'success',
    payload: {
      overrideId: override.id,
      from: override.fromDepartment,
      to: override.toDepartment,
      occurrences: override.occurrences,
      weight: override.weight,
    },
    confidence: null,
    latencyMs: 0,
    mode: 'live',
    createdAt: override.lastAppliedAt ?? override.createdAt,
  };
}
