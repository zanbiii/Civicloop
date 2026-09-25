/**
 * Agent 2 — Geo-Spatial Deduplication.
 *
 * Solves "50 citizens report 1 pothole = 1 master ticket, not 50 tickets".
 * Finds open master tickets of the same category within 75 m (Haversine),
 * merges the new report into the nearest one, grows its impact counter, and
 * signals a severity escalation once enough citizens have corroborated it.
 */

import {
  DEDUP_RADIUS_METERS,
  escalateSeverity,
  type AgentAuditLog,
  type CivicTicket,
  type ComplaintCategory,
  type DedupDecision,
  type DuplicateCandidate,
  type GeoPoint,
  type Severity,
  type TicketStatus,
} from '@/types/civic';
import { haversineMeters } from '@/lib/haversine';

const OPEN_STATUSES: TicketStatus[] = [
  'Submitted',
  'Triaged',
  'Assigned',
  'In Progress',
  'Proof Submitted',
  'Pending Citizen Confirmation',
  'Reopened',
];

/** Every N corroborating supporters earns the master ticket one severity bump. */
const ESCALATION_STEP = 5;

export interface DedupClusterInput {
  category: ComplaintCategory;
  location: GeoPoint;
  /** Every ticket currently in the system — the agent filters down to open masters itself. */
  allTickets: CivicTicket[];
  now?: Date;
}

export interface DedupClusterResult {
  decision: DedupDecision;
  /** The master ticket this report attaches to, or null when it becomes its own master. */
  masterTicket: CivicTicket | null;
  /** New severity for the master, set only when `decision.urgencyEscalations > 0`. */
  escalatedSeverity: Severity | null;
}

function matchScoreFor(distanceMeters: number, ageHours: number): number {
  const distancePenalty = (distanceMeters / DEDUP_RADIUS_METERS) * 35;
  const agePenalty = Math.min(20, ageHours / 6);
  return Math.max(45, Math.round(97 - distancePenalty - agePenalty));
}

export function runDedupCluster(input: DedupClusterInput): DedupClusterResult {
  const now = input.now ?? new Date();

  const candidates = input.allTickets
    .filter((ticket) => ticket.isMaster && ticket.category === input.category && OPEN_STATUSES.includes(ticket.status))
    .map((ticket) => ({
      ticket,
      distanceMeters: Math.round(haversineMeters(input.location, ticket.location)),
      ageHours: (now.getTime() - new Date(ticket.createdAt).getTime()) / 3_600_000,
    }))
    .filter((entry) => entry.distanceMeters <= DEDUP_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (candidates.length === 0) {
    return {
      decision: {
        outcome: 'master',
        masterTicketId: null,
        radiusMeters: DEDUP_RADIUS_METERS,
        candidates: [],
        impactCount: 1,
        urgencyEscalations: 0,
        rationale: `No open ${input.category} report within ${DEDUP_RADIUS_METERS} m — opened as a new master civic issue.`,
        decidedAt: now.toISOString(),
      },
      masterTicket: null,
      escalatedSeverity: null,
    };
  }

  const [best] = candidates;
  const duplicateCandidates: DuplicateCandidate[] = candidates.map((entry) => ({
    ticketId: entry.ticket.id,
    referenceCode: entry.ticket.referenceCode,
    category: entry.ticket.category,
    distanceMeters: entry.distanceMeters,
    ageHours: Math.round(entry.ageHours * 10) / 10,
    matchScore: matchScoreFor(entry.distanceMeters, entry.ageHours),
  }));

  const newImpactCount = best.ticket.impactCount + 1;
  const priorEscalations = Math.floor((best.ticket.impactCount - 1) / ESCALATION_STEP);
  const nextEscalations = Math.floor((newImpactCount - 1) / ESCALATION_STEP);
  const urgencyEscalations = Math.max(0, nextEscalations - priorEscalations);

  return {
    decision: {
      outcome: 'merged',
      masterTicketId: best.ticket.id,
      radiusMeters: DEDUP_RADIUS_METERS,
      candidates: duplicateCandidates,
      impactCount: newImpactCount,
      urgencyEscalations,
      rationale:
        `${duplicateCandidates.length} open ${input.category} report(s) found within ${DEDUP_RADIUS_METERS} m. ` +
        `Folded into ${best.ticket.referenceCode} (${best.distanceMeters} m away) rather than opening a new ticket. ` +
        `Impact counter now ${newImpactCount} citizen(s).` +
        (urgencyEscalations > 0 ? ' Crowd corroboration triggered a severity escalation.' : ''),
      decidedAt: now.toISOString(),
    },
    masterTicket: best.ticket,
    escalatedSeverity: urgencyEscalations > 0 ? escalateSeverity(best.ticket.severity, urgencyEscalations) : null,
  };
}

export function auditLogForDedup(newTicketId: string, result: DedupClusterResult, latencyMs: number): AgentAuditLog {
  const { decision } = result;
  return {
    id: `log-dedup-${newTicketId}-${Date.now()}`,
    ticketId: decision.masterTicketId ?? newTicketId,
    agent: 'DedupCluster',
    action: decision.outcome === 'merged' ? 'dedup.merge' : 'dedup.new-master',
    message: decision.rationale,
    level: decision.urgencyEscalations > 0 ? 'warning' : decision.outcome === 'merged' ? 'success' : 'info',
    payload: {
      outcome: decision.outcome,
      radiusMeters: decision.radiusMeters,
      impactCount: decision.impactCount,
      candidateCount: decision.candidates.length,
    },
    confidence: decision.candidates[0]?.matchScore ?? null,
    latencyMs,
    mode: 'live',
    createdAt: decision.decidedAt,
  };
}
