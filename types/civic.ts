/**
 * Civicloop — Core domain model.
 *
 * Every agent, dashboard and route in the application is typed against the
 * contracts declared here. Runtime constant tables live alongside their derived
 * union types so a single edit keeps compile-time and run-time in sync.
 */

/* ------------------------------------------------------------------------- */
/* Roles & identity                                                          */
/* ------------------------------------------------------------------------- */

export const USER_ROLES = ['citizen', 'volunteer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEPARTMENTS = [
  'Sanitation',
  'PWD/Roads',
  'Electricity/BESCOM',
  'Water/Jal Board',
  'Traffic',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_META: Record<
  Department,
  { shortCode: string; icon: string; accent: string; escalationContact: string }
> = {
  Sanitation: {
    shortCode: 'SWM',
    icon: '\u{1F9F9}',
    accent: '#16a34a',
    escalationContact: 'Zonal Commissioner — Solid Waste Management',
  },
  'PWD/Roads': {
    shortCode: 'PWD',
    icon: '\u{1F6E3}\u{FE0F}',
    accent: '#f97316',
    escalationContact: 'Chief Engineer — Roads & Infrastructure',
  },
  'Electricity/BESCOM': {
    shortCode: 'BESCOM',
    icon: '⚡',
    accent: '#eab308',
    escalationContact: 'Executive Engineer — BESCOM Sub-Division',
  },
  'Water/Jal Board': {
    shortCode: 'BWSSB',
    icon: '\u{1F4A7}',
    accent: '#0ea5e9',
    escalationContact: 'Assistant Executive Engineer — BWSSB',
  },
  Traffic: {
    shortCode: 'TRF',
    icon: '\u{1F6A6}',
    accent: '#a855f7',
    escalationContact: 'DCP Traffic — Zonal Command',
  },
};

/**
 * A citizen as the *public* sees them. Real names and phone numbers never leave
 * the server unmasked; the privacy-preserving pipeline emits this shape only.
 */
export interface PublicReporter {
  id: string;
  /** Pseudonymous handle, e.g. "Citizen #4821". */
  displayName: string;
  /** Last four digits only. */
  maskedPhone: string;
  verified: boolean;
  /** Ward the reporter belongs to — coarse enough to be non-identifying. */
  ward: string | null;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  clearance: 'super-admin';
}

export const VOLUNTEER_TIERS = ['bronze', 'silver', 'gold'] as const;
export type VolunteerTier = (typeof VOLUNTEER_TIERS)[number];

/** Rating at or above this unlocks the automatic Gold Tier bounty bonus. */
export const GOLD_TIER_RATING_THRESHOLD = 4.8;
export const SILVER_TIER_RATING_THRESHOLD = 4.2;

/**
 * A Community Volunteer (CoV) — a civic responder who handles department
 * tickets and bounty missions, then gets paid from the sponsoring CSR fund
 * once CivicProof verifies the fix and the citizen confirms it.
 */
export interface VolunteerProfile {
  id: string;
  name: string;
  maskedPhone: string;
  /** Simulated UPI handle the payout receipt is "sent" to, e.g. "ramesh@oksbi". */
  upiId: string;
  /** 0–5, averaged from citizen feedback. */
  rating: number;
  ratingCount: number;
  tier: VolunteerTier;
  totalEarnedInr: number;
  completedMissions: number;
  zone: string;
  department: Department;
  designation?: string;
  /** Where this CoV is based, for the "N volunteers nearby" distance check. */
  homeBase: GeoPoint;
  /** Flavour title shown on the leaderboard, e.g. "Neighborhood Hero". */
  badge: string;
}

export type SessionUser =
  | { role: 'citizen'; profile: PublicReporter }
  | { role: 'volunteer'; profile: VolunteerProfile }
  | { role: 'admin'; profile: AdminProfile };

/* ------------------------------------------------------------------------- */
/* Categories                                                                */
/* ------------------------------------------------------------------------- */

export const COMPLAINT_CATEGORIES = [
  'Pothole',
  'Garbage accumulation',
  'Broken streetlight',
  'Overflowing drain',
  'Damaged road',
  'Fallen tree',
  'Water leakage',
  'Traffic obstruction',
  'Damaged public infrastructure',
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

/* ------------------------------------------------------------------------- */
/* Severity & SLA                                                            */
/* ------------------------------------------------------------------------- */

export const SEVERITIES = ['Emergency', 'Very High', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Contractual response windows, in hours, per the Civicloop SLA charter. */
export const SLA_HOURS: Record<Severity, number> = {
  Emergency: 2,
  'Very High': 12,
  High: 24,
  Medium: 72,
  Low: 168,
};

export const SEVERITY_META: Record<
  Severity,
  { rank: number; pin: string; label: string; textClass: string; badgeClass: string }
> = {
  Emergency: {
    rank: 5,
    pin: '#dc2626',
    label: 'Emergency · 2h',
    textClass: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-700 border-red-300',
  },
  'Very High': {
    rank: 4,
    pin: '#ea580c',
    label: 'Very High · 12h',
    textClass: 'text-orange-600',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-300',
  },
  High: {
    rank: 3,
    pin: '#f59e0b',
    label: 'High · 24h',
    textClass: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  Medium: {
    rank: 2,
    pin: '#eab308',
    label: 'Medium · 72h',
    textClass: 'text-yellow-600',
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  Low: {
    rank: 1,
    pin: '#16a34a',
    label: 'Low · 7d',
    textClass: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-700 border-green-300',
  },
};

export const CATEGORY_META: Record<
  ComplaintCategory,
  { icon: string; defaultDepartment: Department; baseSeverity: Severity; hazardWeight: number }
> = {
  Pothole: {
    icon: '\u{1F573}\u{FE0F}',
    defaultDepartment: 'PWD/Roads',
    baseSeverity: 'High',
    hazardWeight: 0.62,
  },
  'Garbage accumulation': {
    icon: '\u{1F5D1}\u{FE0F}',
    defaultDepartment: 'Sanitation',
    baseSeverity: 'Medium',
    hazardWeight: 0.45,
  },
  'Broken streetlight': {
    icon: '\u{1F4A1}',
    defaultDepartment: 'Electricity/BESCOM',
    baseSeverity: 'High',
    hazardWeight: 0.58,
  },
  'Overflowing drain': {
    icon: '\u{1F30A}',
    defaultDepartment: 'Water/Jal Board',
    baseSeverity: 'Very High',
    hazardWeight: 0.71,
  },
  'Damaged road': {
    icon: '\u{1F6E0}\u{FE0F}',
    defaultDepartment: 'PWD/Roads',
    baseSeverity: 'High',
    hazardWeight: 0.66,
  },
  'Fallen tree': {
    icon: '\u{1F333}',
    defaultDepartment: 'PWD/Roads',
    baseSeverity: 'Very High',
    hazardWeight: 0.78,
  },
  'Water leakage': {
    icon: '\u{1F6B0}',
    defaultDepartment: 'Water/Jal Board',
    baseSeverity: 'Very High',
    hazardWeight: 0.69,
  },
  'Traffic obstruction': {
    icon: '\u{1F6A7}',
    defaultDepartment: 'Traffic',
    baseSeverity: 'Very High',
    hazardWeight: 0.74,
  },
  'Damaged public infrastructure': {
    icon: '\u{1F3D7}\u{FE0F}',
    defaultDepartment: 'PWD/Roads',
    baseSeverity: 'Medium',
    hazardWeight: 0.52,
  },
};

export type SlaHealth = 'on_track' | 'warning' | 'breached' | 'met';

export interface SlaState {
  severity: Severity;
  slaHours: number;
  /** ISO timestamp the SLA clock started (triage completion). */
  startedAt: string;
  /** ISO timestamp the SLA expires. */
  dueAt: string;
  /** 0–100+; values above 100 mean the window has been blown. */
  percentElapsed: number;
  health: SlaHealth;
  /** Set once the 75 % sentinel warning fires, so it never double-fires. */
  warnedAt: string | null;
  breachedAt: string | null;
  /** 0 = none, 1 = supervisor, 2 = zonal commissioner, 3 = commissioner office. */
  escalationLevel: 0 | 1 | 2 | 3;
  escalatedTo: string | null;
  /** Auto-generated briefing handed to the escalation contact. */
  escalationBriefing: string | null;
  metAt: string | null;
}

/* ------------------------------------------------------------------------- */
/* Geo                                                                       */
/* ------------------------------------------------------------------------- */

export interface GeoPoint {
  lat: number;
  lng: number;
  /** GPS accuracy reported by the browser, in metres. */
  accuracyMeters?: number;
  address?: string;
  ward?: string;
  zone?: string;
}

/** Radius, in metres, inside which same-category reports are one civic issue. */
export const DEDUP_RADIUS_METERS = 75;

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/* ------------------------------------------------------------------------- */
/* Evidence                                                                  */
/* ------------------------------------------------------------------------- */

export type EvidenceKind = 'before' | 'after';
export type EvidenceSource = 'camera' | 'upload' | 'seed';

export interface EvidencePhoto {
  id: string;
  kind: EvidenceKind;
  /** Remote URL, or a `data:` base64 payload when Cloudinary is unavailable. */
  url: string;
  source: EvidenceSource;
  capturedAt: string;
  capturedBy: string;
  /** Geotag read off the device at capture time, when permitted. */
  geo: GeoPoint | null;
  caption: string | null;
}

export type InputMode = 'photo' | 'voice' | 'text' | 'map-pin';

/* ------------------------------------------------------------------------- */
/* Agent 1 — CivicEye multimodal intake                                      */
/* ------------------------------------------------------------------------- */

export type AgentRunMode = 'live' | 'mock';

export interface CivicEyeAnalysis {
  category: ComplaintCategory;
  /** Evidence Confidence Score, 0–100. */
  confidence: number;
  /** Human-readable description of what the vision model saw. */
  observation: string;
  detectedObjects: string[];
  /** Model-suggested severity, before triage refines it. */
  suggestedSeverity: Severity;
  hazardIndicators: string[];
  /** Ranked runner-up categories, surfaced in the admin brain view. */
  alternatives: Array<{ category: ComplaintCategory; confidence: number }>;
  /** True when the photo does not depict a civic issue at all. */
  rejected: boolean;
  rejectionReason: string | null;
  model: string;
  mode: AgentRunMode;
  analyzedAt: string;
}

/* ------------------------------------------------------------------------- */
/* Agent 2 — Geo-spatial deduplication                                       */
/* ------------------------------------------------------------------------- */

export interface TicketSupporter {
  id: string;
  ticketId: string;
  reporter: PublicReporter;
  joinedAt: string;
  /** Distance from the master pin, in metres. */
  distanceMeters: number;
  note: string | null;
  /** Extra photos contributed by a co-reporter. */
  photos: EvidencePhoto[];
}

export interface DuplicateCandidate {
  ticketId: string;
  referenceCode: string;
  category: ComplaintCategory;
  distanceMeters: number;
  ageHours: number;
  /** 0–100 likelihood this is the same physical civic issue. */
  matchScore: number;
}

export interface DedupDecision {
  /** `merged` => attached to a master; `master` => this ticket is the master. */
  outcome: 'master' | 'merged';
  masterTicketId: string | null;
  radiusMeters: number;
  candidates: DuplicateCandidate[];
  /** Impact counter after the merge, e.g. 18 => "Reported by 18 citizens". */
  impactCount: number;
  /** Severity bumps earned purely from crowd corroboration. */
  urgencyEscalations: number;
  rationale: string;
  decidedAt: string;
}

/* ------------------------------------------------------------------------- */
/* Agent 3 — Smart triage, routing & self-healing                            */
/* ------------------------------------------------------------------------- */

export interface TriageDecision {
  department: Department;
  severity: Severity;
  slaHours: number;
  /** 0–100 confidence in the department choice. */
  routingConfidence: number;
  rationale: string;
  /** Signals that pushed severity up or down, kept for the audit trail. */
  severitySignals: string[];
  /** Set when a learned override (self-healing memory) changed the outcome. */
  appliedOverrideId: string | null;
  zoneKey: string;
  model: string;
  mode: AgentRunMode;
  decidedAt: string;
}

/** One learned correction in the self-healing routing graph. */
export interface RoutingOverride {
  id: string;
  category: ComplaintCategory;
  /** Zone key the correction applies to, e.g. "Koramangala:BLR-SE". */
  zoneKey: string;
  centroid: GeoPoint;
  radiusMeters: number;
  fromDepartment: Department;
  toDepartment: Department;
  /** How many independent corrections agree; drives `weight`. */
  occurrences: number;
  /** 0–1. Above the activation threshold the override rewrites routing. */
  weight: number;
  reason: string;
  correctedBy: string;
  createdAt: string;
  lastAppliedAt: string | null;
  /** Number of later tickets auto-corrected by this rule. */
  autoCorrectedCount: number;
}

export interface RoutingEvent {
  id: string;
  ticketId: string;
  fromDepartment: Department | null;
  toDepartment: Department;
  trigger: 'initial-triage' | 'cov-reroute' | 'self-healing' | 'escalation';
  reason: string;
  actor: string;
  createdAt: string;
}

/* ------------------------------------------------------------------------- */
/* Agent 5 — CivicProof verification                                         */
/* ------------------------------------------------------------------------- */

export type ProofVerdict = 'verified' | 'rejected' | 'inconclusive';

export interface CivicProofVerification {
  verdict: ProofVerdict;
  /** 0–100 confidence that the after-photo shows the same place, repaired. */
  confidence: number;
  /** 0–100 similarity of background landmarks across before/after. */
  landmarkMatch: number;
  /** 0–100 evidence that the defect itself is actually gone. */
  repairEvidence: number;
  landmarksMatched: string[];
  discrepancies: string[];
  summary: string;
  beforePhotoId: string;
  afterPhotoId: string;
  submittedBy: string;
  model: string;
  mode: AgentRunMode;
  verifiedAt: string;
}

export interface CitizenConfirmation {
  decision: 'approved' | 'rejected';
  rating: 1 | 2 | 3 | 4 | 5 | null;
  /** One-tap praise chips the citizen attached — see PRAISE_CHIPS below. */
  praiseChips: string[];
  comment: string | null;
  confirmedBy: string;
  confirmedAt: string;
}

/* ------------------------------------------------------------------------- */
/* Agent audit trail                                                         */
/* ------------------------------------------------------------------------- */

export const AGENT_NAMES = [
  'CivicEye',
  'DedupCluster',
  'TriageRouting',
  'SlaSentinel',
  'CivicProof',
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_META: Record<AgentName, { label: string; icon: string; color: string }> = {
  CivicEye: { label: 'CivicEye Multimodal Intake', icon: '\u{1F441}\u{FE0F}', color: '#38bdf8' },
  DedupCluster: { label: 'Geo-Spatial Deduplication', icon: '\u{1F9ED}', color: '#a78bfa' },
  TriageRouting: {
    label: 'Smart Triage & Self-Healing Routing',
    icon: '\u{1F9E0}',
    color: '#34d399',
  },
  SlaSentinel: { label: 'SLA Sentinel & Escalation', icon: '⏱\u{FE0F}', color: '#fbbf24' },
  CivicProof: { label: 'CivicProof Verification & Closure', icon: '✅', color: '#f472b6' },
};

export type AgentLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AgentAuditLog {
  id: string;
  ticketId: string | null;
  agent: AgentName;
  action: string;
  message: string;
  level: AgentLogLevel;
  /** Structured payload rendered as JSON in the agent terminal. */
  payload: Record<string, unknown>;
  confidence: number | null;
  latencyMs: number;
  mode: AgentRunMode;
  createdAt: string;
}

/* ------------------------------------------------------------------------- */
/* Tickets                                                                   */
/* ------------------------------------------------------------------------- */

export const TICKET_STATUSES = [
  'Submitted',
  'Triaged',
  'Assigned',
  'In Progress',
  'Proof Submitted',
  'Pending Citizen Confirmation',
  'Resolved',
  'Rejected',
  'Reopened',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_META: Record<TicketStatus, { badgeClass: string; step: number }> = {
  Submitted: { badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', step: 1 },
  Triaged: { badgeClass: 'bg-sky-100 text-sky-700 border-sky-300', step: 2 },
  Assigned: { badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300', step: 3 },
  'In Progress': { badgeClass: 'bg-violet-100 text-violet-700 border-violet-300', step: 4 },
  'Proof Submitted': { badgeClass: 'bg-teal-100 text-teal-700 border-teal-300', step: 5 },
  'Pending Citizen Confirmation': {
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300',
    step: 6,
  },
  Resolved: { badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300', step: 7 },
  Rejected: { badgeClass: 'bg-red-100 text-red-700 border-red-300', step: 7 },
  Reopened: { badgeClass: 'bg-orange-100 text-orange-700 border-orange-300', step: 4 },
};

export interface CivicTicket {
  id: string;
  /** Human-facing code, e.g. "CIVIC-2026-004821". */
  referenceCode: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: TicketStatus;
  severity: Severity;
  location: GeoPoint;
  reporter: PublicReporter;
  language: 'en' | 'kn' | 'hi';
  inputModes: InputMode[];
  voiceTranscript: string | null;

  /** Deduplication state. A merged ticket points at its master. */
  isMaster: boolean;
  masterTicketId: string | null;
  supporters: TicketSupporter[];
  /** Denormalised `supporters.length + 1`, for fast "Reported by N citizens". */
  impactCount: number;

  beforePhotos: EvidencePhoto[];
  afterPhotos: EvidencePhoto[];

  assignedDepartment: Department;
  assignedOfficer: string | null;
  routingHistory: RoutingEvent[];

  civicEye: CivicEyeAnalysis | null;
  dedup: DedupDecision | null;
  triage: TriageDecision | null;
  sla: SlaState;
  proof: CivicProofVerification | null;
  citizenConfirmation: CitizenConfirmation | null;
  /** Null for a merged duplicate — only the master ticket carries the bounty. */
  bounty: BountyInfo | null;

  auditLog: AgentAuditLog[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

/** Payload the citizen intake form hands to the agent pipeline. */
export interface IntakeDraft {
  description: string;
  photos: EvidencePhoto[];
  location: GeoPoint;
  voiceTranscript: string | null;
  inputModes: InputMode[];
  language: 'en' | 'kn' | 'hi';
  reporter: PublicReporter;
  /** Citizen may override CivicEye's category; null means "trust the agent". */
  categoryOverride: ComplaintCategory | null;
}

/* ------------------------------------------------------------------------- */
/* Aggregate telemetry surfaced on the AI Brain dashboard                    */
/* ------------------------------------------------------------------------- */

export interface BrainTelemetry {
  totalReports: number;
  masterIssues: number;
  duplicatesMerged: number;
  duplicateReductionPercent: number;
  citizensEngaged: number;
  slaOnTrack: number;
  slaWarning: number;
  slaBreached: number;
  slaMet: number;
  autoEscalations: number;
  routingOverrides: number;
  ticketsAutoCorrected: number;
  routingAccuracyPercent: number;
  proofVerified: number;
  proofRejected: number;
  avgResolutionHours: number;
  byDepartment: Array<{ department: Department; open: number; resolved: number; breached: number }>;
  byCategory: Array<{ category: ComplaintCategory; count: number }>;
}

/* ------------------------------------------------------------------------- */
/* Civic Bounty Network — CSR-funded gig payouts                            */
/* ------------------------------------------------------------------------- */

export type BountyStatus = 'open' | 'claimed' | 'in_progress' | 'pending_payout' | 'paid';

/** One citizen (or CSR auto-boost) pledge that raises a bounty's pot. */
export interface BountyPledge {
  id: string;
  ticketId: string;
  /** Null when the pledge is an automatic CSR top-up rather than a citizen boost. */
  citizenId: string | null;
  citizenDisplayName: string | null;
  amountInr: number;
  source: 'citizen-boost' | 'csr-auto-boost';
  pledgedAt: string;
}

/**
 * The bounty attached to a master ticket. `baseAmount` is set once by Smart
 * Triage from the repair-effort estimate; everything else accumulates as
 * citizens boost it, a volunteer claims it, and CivicProof + the citizen
 * clear it for payout.
 */
export interface BountyInfo {
  baseAmount: number;
  /** Sum of every BountyPledge — citizen boosts plus CSR auto-boosts. */
  communityBonus: number;
  /** +₹100 automatic bonus, applied at payout if the claiming volunteer's rating clears the gold threshold. */
  goldBonus: number;
  csrSponsor: string;
  status: BountyStatus;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  paidAt: string | null;
  /** e.g. "#CSR-89210-BLR", generated at payout time. */
  transactionId: string | null;
  pledges: BountyPledge[];
}

/** `baseAmount + communityBonus + goldBonus`. */
export function bountyTotal(bounty: BountyInfo): number {
  return bounty.baseAmount + bounty.communityBonus + bounty.goldBonus;
}

export interface DepotInventoryItem {
  item: string;
  quantity: number;
  /** The CSR programme funding this stock, e.g. "Tata Urban CSR Fund". */
  sponsor: string;
}

/** A hardware/materials pickup point CoVs can draw free CSR-funded stock from. */
export interface ToolDepot {
  id: string;
  name: string;
  location: GeoPoint;
  inventory: DepotInventoryItem[];
}

/** The corporate CSR programme sponsoring bounties in a zone. Demo-illustrative figures, not live accounting. */
export interface CsrFund {
  id: string;
  sponsorName: string;
  zone: string;
  purpose: string;
  totalPoolInr: number;
  /** Currently allocated/reserved across open and in-flight bounties. */
  activeBalanceInr: number;
  /** Cumulative lifetime payout — the seed baseline; the session adds newly paid bounties on top. */
  disbursedToDateInr: number;
  activeVolunteerCount: number;
  avgFixHours: number;
  /** Illustrative comparison figure for the "vs government" stat, in days. */
  govtBaselineDays: number;
}

/** One-tap praise chips a citizen can attach to their 5-star volunteer rating. */
export const PRAISE_CHIPS = ['⚡ Super Fast', '🧹 Spotless Finish', '🛡️ High Quality'] as const;
export type PraiseChip = (typeof PRAISE_CHIPS)[number];

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------- */

export function isComplaintCategory(value: string): value is ComplaintCategory {
  return (COMPLAINT_CATEGORIES as readonly string[]).includes(value);
}

export function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as readonly string[]).includes(value);
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

/** Masks an Indian mobile number down to its last four digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '+91 ●●●●●●●●●●';
  return `+91 ●●●●●●${digits.slice(-4)}`;
}

/** Deterministic pseudonym, so the same citizen keeps the same public handle. */
export function pseudonymFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `Citizen #${(Math.abs(hash) % 9000) + 1000}`;
}

/** Ranks two severities; positive when `a` is more urgent than `b`. */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_META[a].rank - SEVERITY_META[b].rank;
}

/** Bumps a severity up `steps` levels, clamped at `Emergency`. */
export function escalateSeverity(severity: Severity, steps = 1): Severity {
  const ordered: Severity[] = ['Low', 'Medium', 'High', 'Very High', 'Emergency'];
  const index = ordered.indexOf(severity);
  return ordered[Math.min(ordered.length - 1, index + steps)];
}
