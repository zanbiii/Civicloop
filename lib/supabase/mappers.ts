/**
 * Row <-> domain-type mappers for the Supabase persistence layer.
 *
 * Two fields are intentionally NOT columns and are reconstructed here:
 *  - `sla.percentElapsed` is always recomputed from `sla_started_at` /
 *    `sla_hours` against the current clock — storing it would just go stale
 *    between sentinel sweeps.
 *  - `sla.metAt` mirrors `resolved_at`: the app only ever stops the SLA
 *    clock (`markSlaResolved`) in the same operation that sets `resolvedAt`.
 */

import {
  isComplaintCategory,
  isDepartment,
  isSeverity,
  type AgentAuditLog,
  type CivicTicket,
  type EvidencePhoto,
  type PublicReporter,
  type RoutingEvent,
  type RoutingOverride,
  type SlaHealth,
  type TicketStatus,
  type TicketSupporter,
} from '@/types/civic';

const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------------- */
/* Rows, as PostgREST returns them                                           */
/* ------------------------------------------------------------------------- */

export interface TicketRow {
  id: string;
  reference_code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  severity: string;
  lat: number;
  lng: number;
  accuracy_meters: number | null;
  address: string | null;
  ward: string | null;
  zone: string | null;
  reporter_id: string | null;
  reporter: unknown;
  language: string;
  input_modes: string[];
  voice_transcript: string | null;
  is_master: boolean;
  master_ticket_id: string | null;
  impact_count: number;
  assigned_department: string;
  assigned_officer: string | null;
  sla_hours: number;
  sla_started_at: string | null;
  sla_due_at: string | null;
  sla_health: string;
  sla_warned_at: string | null;
  sla_breached_at: string | null;
  escalation_level: number;
  escalated_to: string | null;
  escalation_briefing: string | null;
  civic_eye: unknown;
  dedup: unknown;
  triage: unknown;
  proof: unknown;
  citizen_confirmation: unknown;
  bounty: unknown;
  before_photos: unknown;
  after_photos: unknown;
  tags: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupporterRow {
  id: string;
  ticket_id: string;
  supporter: unknown;
  distance_meters: number;
  note: string | null;
  photos: unknown;
  joined_at: string;
}

export interface RoutingEventRow {
  id: string;
  ticket_id: string;
  from_department: string | null;
  to_department: string;
  trigger: string;
  reason: string;
  actor: string;
  created_at: string;
}

export interface RoutingOverrideRow {
  id: string;
  category: string;
  zone_key: string;
  centroid_lat: number;
  centroid_lng: number;
  radius_meters: number;
  from_department: string;
  to_department: string;
  occurrences: number;
  weight: number;
  reason: string;
  corrected_by: string | null;
  auto_corrected_count: number;
  last_applied_at: string | null;
  created_at: string;
}

export interface AgentLogRow {
  id: string;
  ticket_id: string | null;
  agent: string;
  action: string;
  message: string;
  level: string;
  payload: unknown;
  confidence: number | null;
  latency_ms: number;
  mode: string;
  created_at: string;
}

/* ------------------------------------------------------------------------- */
/* Row -> domain type                                                        */
/* ------------------------------------------------------------------------- */

function asReporter(value: unknown, fallbackId: string | null): PublicReporter {
  if (value && typeof value === 'object' && 'displayName' in value) return value as PublicReporter;
  return { id: fallbackId ?? 'unknown', displayName: 'Citizen', maskedPhone: '+91 ●●●●●●●●●●', verified: false, ward: null };
}

function computePercentElapsed(startedAt: string | null, slaHours: number, now: Date): number {
  if (!startedAt || slaHours <= 0) return 0;
  return Math.max(0, Math.round(((now.getTime() - new Date(startedAt).getTime()) / (slaHours * HOUR_MS)) * 100));
}

export function rowToSupporter(row: SupporterRow): TicketSupporter {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    reporter: asReporter(row.supporter, null),
    joinedAt: row.joined_at,
    distanceMeters: row.distance_meters,
    note: row.note,
    photos: (row.photos as EvidencePhoto[] | null) ?? [],
  };
}

export function rowToRoutingEvent(row: RoutingEventRow): RoutingEvent {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    fromDepartment: row.from_department && isDepartment(row.from_department) ? row.from_department : null,
    toDepartment: isDepartment(row.to_department) ? row.to_department : 'PWD/Roads',
    trigger: row.trigger as RoutingEvent['trigger'],
    reason: row.reason,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

export function rowToRoutingOverride(row: RoutingOverrideRow): RoutingOverride {
  const [ward, zone] = row.zone_key.split(':');
  return {
    id: row.id,
    category: isComplaintCategory(row.category) ? row.category : 'Damaged public infrastructure',
    zoneKey: row.zone_key,
    centroid: { lat: row.centroid_lat, lng: row.centroid_lng, ward, zone },
    radiusMeters: row.radius_meters,
    fromDepartment: isDepartment(row.from_department) ? row.from_department : 'PWD/Roads',
    toDepartment: isDepartment(row.to_department) ? row.to_department : 'PWD/Roads',
    occurrences: row.occurrences,
    weight: row.weight,
    reason: row.reason,
    correctedBy: row.corrected_by ?? 'Authority',
    createdAt: row.created_at,
    lastAppliedAt: row.last_applied_at,
    autoCorrectedCount: row.auto_corrected_count,
  };
}

export function rowToAgentLog(row: AgentLogRow): AgentAuditLog {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    agent: row.agent as AgentAuditLog['agent'],
    action: row.action,
    message: row.message,
    level: row.level as AgentAuditLog['level'],
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    confidence: row.confidence,
    latencyMs: row.latency_ms,
    mode: row.mode as AgentAuditLog['mode'],
    createdAt: row.created_at,
  };
}

/** Assembles a full `CivicTicket` from its row plus pre-fetched child rows. */
export function rowToTicket(
  row: TicketRow,
  supporters: SupporterRow[],
  routingEvents: RoutingEventRow[],
  now: Date,
): CivicTicket {
  const health = row.sla_health as SlaHealth;
  return {
    id: row.id,
    referenceCode: row.reference_code,
    title: row.title,
    description: row.description,
    category: isComplaintCategory(row.category) ? row.category : 'Damaged public infrastructure',
    status: row.status as TicketStatus,
    severity: isSeverity(row.severity) ? row.severity : 'Medium',
    location: {
      lat: row.lat,
      lng: row.lng,
      accuracyMeters: row.accuracy_meters ?? undefined,
      address: row.address ?? undefined,
      ward: row.ward ?? undefined,
      zone: row.zone ?? undefined,
    },
    reporter: asReporter(row.reporter, row.reporter_id),
    language: (row.language as CivicTicket['language']) ?? 'en',
    inputModes: (row.input_modes ?? []) as CivicTicket['inputModes'],
    voiceTranscript: row.voice_transcript,
    isMaster: row.is_master,
    masterTicketId: row.master_ticket_id,
    supporters: supporters.map(rowToSupporter),
    impactCount: row.impact_count,
    beforePhotos: (row.before_photos as EvidencePhoto[] | null) ?? [],
    afterPhotos: (row.after_photos as EvidencePhoto[] | null) ?? [],
    assignedDepartment: isDepartment(row.assigned_department) ? row.assigned_department : 'PWD/Roads',
    assignedOfficer: row.assigned_officer,
    routingHistory: routingEvents.map(rowToRoutingEvent),
    civicEye: row.civic_eye as CivicTicket['civicEye'],
    dedup: row.dedup as CivicTicket['dedup'],
    triage: row.triage as CivicTicket['triage'],
    sla: {
      severity: isSeverity(row.severity) ? row.severity : 'Medium',
      slaHours: row.sla_hours,
      startedAt: row.sla_started_at ?? row.created_at,
      dueAt: row.sla_due_at ?? row.created_at,
      percentElapsed: computePercentElapsed(row.sla_started_at, row.sla_hours, now),
      health,
      warnedAt: row.sla_warned_at,
      breachedAt: row.sla_breached_at,
      escalationLevel: row.escalation_level as 0 | 1 | 2 | 3,
      escalatedTo: row.escalated_to,
      escalationBriefing: row.escalation_briefing,
      metAt: row.resolved_at,
    },
    proof: row.proof as CivicTicket['proof'],
    citizenConfirmation: row.citizen_confirmation as CivicTicket['citizenConfirmation'],
    bounty: (row.bounty as CivicTicket['bounty']) ?? null,
    auditLog: [],
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

/* ------------------------------------------------------------------------- */
/* Domain type -> row (for insert/update)                                    */
/* ------------------------------------------------------------------------- */

export function ticketToRow(ticket: CivicTicket): TicketRow {
  return {
    id: ticket.id,
    reference_code: ticket.referenceCode,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    severity: ticket.severity,
    lat: ticket.location.lat,
    lng: ticket.location.lng,
    accuracy_meters: ticket.location.accuracyMeters ?? null,
    address: ticket.location.address ?? null,
    ward: ticket.location.ward ?? null,
    zone: ticket.location.zone ?? null,
    reporter_id: ticket.reporter.id,
    reporter: ticket.reporter,
    language: ticket.language,
    input_modes: ticket.inputModes,
    voice_transcript: ticket.voiceTranscript,
    is_master: ticket.isMaster,
    master_ticket_id: ticket.masterTicketId,
    impact_count: ticket.impactCount,
    assigned_department: ticket.assignedDepartment,
    assigned_officer: ticket.assignedOfficer,
    sla_hours: ticket.sla.slaHours,
    sla_started_at: ticket.sla.startedAt,
    sla_due_at: ticket.sla.dueAt,
    sla_health: ticket.sla.health,
    sla_warned_at: ticket.sla.warnedAt,
    sla_breached_at: ticket.sla.breachedAt,
    escalation_level: ticket.sla.escalationLevel,
    escalated_to: ticket.sla.escalatedTo,
    escalation_briefing: ticket.sla.escalationBriefing,
    civic_eye: ticket.civicEye,
    dedup: ticket.dedup,
    triage: ticket.triage,
    proof: ticket.proof,
    citizen_confirmation: ticket.citizenConfirmation,
    bounty: ticket.bounty,
    before_photos: ticket.beforePhotos,
    after_photos: ticket.afterPhotos,
    tags: ticket.tags,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    resolved_at: ticket.resolvedAt,
  };
}

export function supporterToRow(supporter: TicketSupporter): SupporterRow {
  return {
    id: supporter.id,
    ticket_id: supporter.ticketId,
    supporter: supporter.reporter,
    distance_meters: supporter.distanceMeters,
    note: supporter.note,
    photos: supporter.photos,
    joined_at: supporter.joinedAt,
  };
}

export function routingEventToRow(event: RoutingEvent): RoutingEventRow {
  return {
    id: event.id,
    ticket_id: event.ticketId,
    from_department: event.fromDepartment,
    to_department: event.toDepartment,
    trigger: event.trigger,
    reason: event.reason,
    actor: event.actor,
    created_at: event.createdAt,
  };
}

export function overrideToRow(override: RoutingOverride): RoutingOverrideRow {
  return {
    id: override.id,
    category: override.category,
    zone_key: override.zoneKey,
    centroid_lat: override.centroid.lat,
    centroid_lng: override.centroid.lng,
    radius_meters: override.radiusMeters,
    from_department: override.fromDepartment,
    to_department: override.toDepartment,
    occurrences: override.occurrences,
    weight: override.weight,
    reason: override.reason,
    corrected_by: override.correctedBy,
    auto_corrected_count: override.autoCorrectedCount,
    last_applied_at: override.lastAppliedAt,
    created_at: override.createdAt,
  };
}

export function agentLogToRow(log: AgentAuditLog): AgentLogRow {
  return {
    id: log.id,
    ticket_id: log.ticketId,
    agent: log.agent,
    action: log.action,
    message: log.message,
    level: log.level,
    payload: log.payload,
    confidence: log.confidence,
    latency_ms: log.latencyMs,
    mode: log.mode,
    created_at: log.createdAt,
  };
}
