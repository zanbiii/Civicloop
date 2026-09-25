/**
 * Civicloop — pre-seeded Bangalore civic complaints.
 *
 * ## Why this is a factory, not a frozen constant
 *
 * SLA countdowns are relative to "now". If the seed array were built at module
 * load, the server render and the client hydration would compute different
 * percentages and React would throw a hydration mismatch. So the data is built
 * by `buildSeedData(now)`:
 *
 *   - `SEED_DATA` is anchored to the frozen `SEED_EPOCH` and is therefore
 *     byte-identical on server and client. Render with this.
 *   - After mount, call `buildSeedData(new Date())` to get live, ticking SLAs.
 *
 * Every image URL below is a real `images.unsplash.com` asset. Components should
 * still fall back to `PLACEHOLDER_IMAGE` on an `onError` event so a throttled
 * CDN can never show a broken frame.
 */

import type {
  AgentAuditLog,
  BountyInfo,
  BountyPledge,
  CivicTicket,
  ComplaintCategory,
  CsrFund,
  Department,
  EvidencePhoto,
  GeoPoint,
  PublicReporter,
  RoutingEvent,
  RoutingOverride,
  Severity,
  SlaState,
  TicketSupporter,
  ToolDepot,
  VolunteerProfile,
} from '@/types/civic';
import { SLA_HOURS, maskPhone, pseudonymFor } from '@/types/civic';
import { computeBaseBounty } from '@/lib/bounty';

/* ------------------------------------------------------------------------- */
/* Anchors & assets                                                          */
/* ------------------------------------------------------------------------- */

/** Frozen clock for SSR-stable rendering. */
export const SEED_EPOCH = '2026-09-25T09:30:00.000Z';

const UNSPLASH = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/** Inline SVG shown when a remote evidence image fails to load. */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#0f172a"/>
      <text x="600" y="400" fill="#64748b" font-family="system-ui,sans-serif"
        font-size="38" text-anchor="middle">Evidence unavailable</text>
    </svg>`,
  );

const IMG = {
  potholeBefore: UNSPLASH('photo-1515162816999-a0c47dc192f7'),
  potholeBeforeAlt: UNSPLASH('photo-1573167507387-6b4b98cb7c13'),
  potholeAfter: UNSPLASH('photo-1517457373958-b7bdd4587205'),
  garbageBefore: UNSPLASH('photo-1558618666-fcd25c85cd64'),
  garbageBeforeAlt: UNSPLASH('photo-1532996122724-e3c354a0b15b'),
  garbageAfter: UNSPLASH('photo-1542601906990-b4d3fb778b09'),
  streetlightBefore: UNSPLASH('photo-1517245386807-bb43f82c33c4'),
  streetlightAfter: UNSPLASH('photo-1509391366360-2e959784a276'),
  electricalHazard: UNSPLASH('photo-1621451537084-482c73073a0f'),
  waterLeakBefore: UNSPLASH('photo-1504384308090-c894fdcc538d'),
  waterLeakAfter: UNSPLASH('photo-1470071459604-3b5ec3a7fe05'),
  drainBefore: UNSPLASH('photo-1589829545856-d10d557cf95f'),
  drainAfter: UNSPLASH('photo-1611270629569-8b357cb88da9'),
  treeBefore: UNSPLASH('photo-1477959858617-67f85cf4f1df'),
  trafficBefore: UNSPLASH('photo-1502920917128-1aa500764cbd'),
  roadBefore: UNSPLASH('photo-1480714378408-67cf0d13bc1b'),
  infraBefore: UNSPLASH('photo-1534430480872-3498386e7856'),
  infraAfter: UNSPLASH('photo-1524492412937-b28074a5d7da'),
} as const;

/* ------------------------------------------------------------------------- */
/* Civic Bounty Network — CSR fund, volunteers & tool depots                 */
/*                                                                           */
/* Declared before `buildSeedData` (below) is ever invoked, since that      */
/* function's body closes over these constants.                             */
/* ------------------------------------------------------------------------- */

/** The corporate CSR programme sponsoring bounties across the demo zone. Illustrative figures for the pitch, not live accounting. */
export const CSR_FUND: CsrFund = {
  id: 'csr-tata-koramangala',
  sponsorName: 'Tata Urban CSR Fund',
  zone: 'Koramangala Zone',
  purpose: 'Mandated 2% Corporate Social Responsibility pool for youth micro-employment',
  totalPoolInr: 500_000,
  activeBalanceInr: 485_000,
  disbursedToDateInr: 64_500,
  activeVolunteerCount: 42,
  avgFixHours: 3.2,
  govtBaselineDays: 45,
};

/** Six seeded Community Volunteers (CoVs), ranked by lifetime earnings for the Hall of Fame leaderboard. */
export const SEED_VOLUNTEERS: VolunteerProfile[] = [
  {
    id: 'volunteer-deepa-indiranagar',
    name: 'Deepa N.',
    maskedPhone: maskPhone('9880011223'),
    upiId: 'deepa.n@okaxis',
    rating: 4.95,
    ratingCount: 41,
    tier: 'gold',
    totalEarnedInr: 9_800,
    completedMissions: 38,
    zone: 'Indiranagar',
    homeBase: { lat: 12.9719, lng: 77.6412, ward: 'Indiranagar', zone: 'BBMP-East' },
    badge: 'Top Earner',
  },
  {
    id: 'volunteer-ramesh-hsr',
    name: 'Ramesh K.',
    maskedPhone: maskPhone('9845098450'),
    upiId: 'ramesh@oksbi',
    rating: 4.9,
    ratingCount: 37,
    tier: 'gold',
    totalEarnedInr: 8_450,
    completedMissions: 34,
    zone: 'HSR Layout',
    homeBase: { lat: 12.9121, lng: 77.6446, ward: 'HSR Layout', zone: 'BBMP-Bommanahalli' },
    badge: 'Neighborhood Hero',
  },
  {
    id: 'volunteer-priya-koramangala',
    name: 'Priya S.',
    maskedPhone: maskPhone('9900223344'),
    upiId: 'priya.s@ybl',
    rating: 4.85,
    ratingCount: 30,
    tier: 'gold',
    totalEarnedInr: 7_200,
    completedMissions: 29,
    zone: 'Koramangala',
    homeBase: { lat: 12.9352, lng: 77.6245, ward: 'Koramangala', zone: 'BBMP-South' },
    badge: 'Speed Demon',
  },
  {
    id: 'volunteer-suresh-btm',
    name: 'Suresh M.',
    maskedPhone: maskPhone('9977112233'),
    upiId: 'suresh.m@paytm',
    rating: 4.5,
    ratingCount: 24,
    tier: 'silver',
    totalEarnedInr: 5_600,
    completedMissions: 22,
    zone: 'BTM Layout',
    homeBase: { lat: 12.9169, lng: 77.6165, ward: 'BTM Layout', zone: 'BBMP-Bommanahalli' },
    badge: 'Steady Hand',
  },
  {
    id: 'volunteer-anita-jayanagar',
    name: 'Anita R.',
    maskedPhone: maskPhone('9911224455'),
    upiId: 'anita.r@okhdfcbank',
    rating: 4.3,
    ratingCount: 17,
    tier: 'silver',
    totalEarnedInr: 4_100,
    completedMissions: 16,
    zone: 'Jayanagar',
    homeBase: { lat: 12.925, lng: 77.5938, ward: 'Jayanagar', zone: 'BBMP-South' },
    badge: 'Rising Star',
  },
  {
    id: 'volunteer-farhan-whitefield',
    name: 'Farhan A.',
    maskedPhone: maskPhone('9822334455'),
    upiId: 'farhan.a@ibl',
    rating: 3.9,
    ratingCount: 10,
    tier: 'bronze',
    totalEarnedInr: 2_300,
    completedMissions: 9,
    zone: 'Whitefield',
    homeBase: { lat: 12.9698, lng: 77.75, ward: 'Whitefield', zone: 'BBMP-Mahadevapura' },
    badge: 'Newcomer',
  },
];

/** The demo "Community Volunteer" quick-switch identity. */
export const DEMO_VOLUNTEER: VolunteerProfile = SEED_VOLUNTEERS[1];

/** Free CSR-funded materials pickup points shown on the map's Tool Depot layer. */
export const SEED_TOOL_DEPOTS: ToolDepot[] = [
  {
    id: 'depot-koramangala',
    name: 'Koramangala Tool Depot',
    location: { lat: 12.9368, lng: 77.6198, ward: 'Koramangala', zone: 'BBMP-South' },
    inventory: [
      { item: 'Cold-mix asphalt bag', quantity: 40, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Safety cone', quantity: 15, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Warning tape roll', quantity: 20, sponsor: 'Tata Urban CSR Fund' },
    ],
  },
  {
    id: 'depot-hsr',
    name: 'HSR Layout Tool Depot',
    location: { lat: 12.9138, lng: 77.6468, ward: 'HSR Layout', zone: 'BBMP-Bommanahalli' },
    inventory: [
      { item: 'Cold-mix asphalt bag', quantity: 25, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Drain rod set', quantity: 10, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Work gloves (pair)', quantity: 30, sponsor: 'Tata Urban CSR Fund' },
    ],
  },
  {
    id: 'depot-btm',
    name: 'BTM Layout Tool Depot',
    location: { lat: 12.9175, lng: 77.6232, ward: 'BTM Layout', zone: 'BBMP-Bommanahalli' },
    inventory: [
      { item: 'Reflective road paint (can)', quantity: 12, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Cold-mix asphalt bag', quantity: 18, sponsor: 'Tata Urban CSR Fund' },
      { item: 'Shovel', quantity: 8, sponsor: 'Tata Urban CSR Fund' },
    ],
  },
];

/* ------------------------------------------------------------------------- */
/* Small builders                                                            */
/* ------------------------------------------------------------------------- */

const HOUR = 3_600_000;

/** ISO timestamp `hours` before the reference clock. */
function ago(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * HOUR).toISOString();
}

/**
 * Builds a privacy-preserving reporter. The raw phone is used only to derive a
 * stable pseudonym and a masked display string — it is never stored on the
 * object, so there is nothing for a leaky component to render.
 */
function reporter(phone: string, ward: string | null, verified = true): PublicReporter {
  return {
    id: `citizen-${phone.slice(-4)}`,
    displayName: pseudonymFor(phone),
    maskedPhone: maskPhone(phone),
    verified,
    ward,
  };
}

function photo(
  id: string,
  kind: EvidencePhoto['kind'],
  url: string,
  capturedAt: string,
  capturedBy: string,
  geo: GeoPoint | null,
  caption: string,
): EvidencePhoto {
  return { id, kind, url, source: 'seed', capturedAt, capturedBy, geo, caption };
}

/**
 * Computes a live SLA state from the severity and the moment the clock started.
 * This is the same arithmetic Agent 4 runs; seeding it here keeps the demo data
 * consistent with whatever the sentinel recomputes on its next tick.
 */
function buildSla(
  now: Date,
  severity: Severity,
  startedAtIso: string,
  options: {
    resolvedAtIso?: string | null;
    escalationLevel?: 0 | 1 | 2 | 3;
    escalatedTo?: string | null;
    escalationBriefing?: string | null;
  } = {},
): SlaState {
  const slaHours = SLA_HOURS[severity];
  const startedAt = new Date(startedAtIso);
  const dueAt = new Date(startedAt.getTime() + slaHours * HOUR);
  const { resolvedAtIso = null, escalationLevel = 0 } = options;

  const endpoint = resolvedAtIso ? new Date(resolvedAtIso) : now;
  const percentElapsed = Math.max(
    0,
    Math.round(((endpoint.getTime() - startedAt.getTime()) / (slaHours * HOUR)) * 100),
  );

  // Resolving the work does not retroactively meet a window that already blew:
  // a late closure stays `breached` so the telemetry cannot be flattered.
  let health: SlaState['health'];
  if (percentElapsed >= 100) health = 'breached';
  else if (resolvedAtIso) health = 'met';
  else if (percentElapsed >= 75) health = 'warning';
  else health = 'on_track';

  return {
    severity,
    slaHours,
    startedAt: startedAtIso,
    dueAt: dueAt.toISOString(),
    percentElapsed,
    health,
    warnedAt:
      percentElapsed >= 75 && !resolvedAtIso
        ? new Date(startedAt.getTime() + slaHours * HOUR * 0.75).toISOString()
        : null,
    breachedAt: health === 'breached' ? dueAt.toISOString() : null,
    escalationLevel,
    escalatedTo: options.escalatedTo ?? null,
    escalationBriefing: options.escalationBriefing ?? null,
    metAt: resolvedAtIso,
  };
}

function routingEvent(
  id: string,
  ticketId: string,
  from: Department | null,
  to: Department,
  trigger: RoutingEvent['trigger'],
  reason: string,
  actor: string,
  createdAt: string,
): RoutingEvent {
  return { id, ticketId, fromDepartment: from, toDepartment: to, trigger, reason, actor, createdAt };
}

function log(
  id: string,
  ticketId: string | null,
  agent: AgentAuditLog['agent'],
  action: string,
  message: string,
  level: AgentAuditLog['level'],
  payload: Record<string, unknown>,
  confidence: number | null,
  latencyMs: number,
  createdAt: string,
): AgentAuditLog {
  return {
    id,
    ticketId,
    agent,
    action,
    message,
    level,
    payload,
    confidence,
    latencyMs,
    mode: 'mock',
    createdAt,
  };
}

/* ------------------------------------------------------------------------- */
/* Co-reporter generation                                                    */
/* ------------------------------------------------------------------------- */

const CO_REPORTER_NOTES = [
  'Two-wheeler skidded here yesterday evening.',
  'Water collects in it, so you cannot judge the depth.',
  'Auto drivers now take the service road to avoid this.',
  'My cab hit it hard on the way to work.',
  'It has widened a lot since the last rain.',
  'School bus route — this is genuinely dangerous.',
  'Third complaint from our apartment association.',
  null,
  'Please fix before the next spell of rain.',
  'Traffic backs up because everyone slows down here.',
  null,
  'Delivery riders complain about this every single day.',
  'Elderly residents cannot cross safely.',
  'Same spot was patched last year and it failed again.',
];

/**
 * Generates `count` co-reporters scattered inside the 75 m cluster radius.
 * Distances and join times are deterministic so the demo never reshuffles.
 */
function coReporters(
  now: Date,
  ticketId: string,
  count: number,
  ward: string,
  oldestHoursAgo: number,
): TicketSupporter[] {
  return Array.from({ length: count }, (_, index) => {
    const phone = `9${(845_120_337 + index * 7_919).toString().padStart(9, '0')}`;
    // Spread supporters across the cluster: 6 m out to ~71 m, never past 75 m.
    const distanceMeters = Math.round(6 + ((index * 23) % 66));
    const joinedHoursAgo = oldestHoursAgo - (index * oldestHoursAgo) / (count + 1);
    return {
      id: `${ticketId}-sup-${index + 1}`,
      ticketId,
      reporter: reporter(phone, ward, index % 4 !== 3),
      joinedAt: ago(now, joinedHoursAgo),
      distanceMeters,
      note: CO_REPORTER_NOTES[index % CO_REPORTER_NOTES.length] ?? null,
      photos: [],
    };
  });
}

/* ------------------------------------------------------------------------- */
/* The seed builder                                                          */
/* ------------------------------------------------------------------------- */

export interface SeedData {
  tickets: CivicTicket[];
  routingOverrides: RoutingOverride[];
  agentLogs: AgentAuditLog[];
}

export function buildSeedData(now: Date = new Date(SEED_EPOCH)): SeedData {
  /* ----------------------------------------------------------------------- */
  /* 1. Koramangala pothole — the flagship deduplication story.              */
  /*    14 co-reporters collapse into one master ticket.                     */
  /* ----------------------------------------------------------------------- */

  const potholeId = 'tkt-koramangala-pothole';
  const potholeCreated = ago(now, 52);
  const potholeLocation: GeoPoint = {
    lat: 12.9352,
    lng: 77.6245,
    accuracyMeters: 8,
    address: '80 Feet Road, near Sony World Signal, Koramangala 4th Block',
    ward: 'Koramangala',
    zone: 'BBMP-South',
  };

  const pothole: CivicTicket = {
    id: potholeId,
    referenceCode: 'CIVIC-2026-004821',
    title: 'Crater-sized pothole at Sony World Signal',
    description:
      'Deep pothole in the left lane right before the Sony World signal. It spans almost half the lane and fills with water after every shower, so riders cannot see how deep it is. Two-wheelers are braking hard and swerving into the next lane.',
    category: 'Pothole',
    status: 'In Progress',
    severity: 'Very High',
    location: potholeLocation,
    reporter: reporter('9845120337', 'Koramangala'),
    language: 'en',
    inputModes: ['photo', 'voice', 'text', 'map-pin'],
    voiceTranscript:
      'There is a very big pothole near Sony World signal on 80 feet road. Every day bikes are slipping here, please fix it fast.',
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, potholeId, 14, 'Koramangala', 50),
    impactCount: 15,
    beforePhotos: [
      photo(
        `${potholeId}-before-1`,
        'before',
        IMG.potholeBefore,
        potholeCreated,
        'Citizen #4821',
        potholeLocation,
        'Left lane approaching the signal, taken at 07:40.',
      ),
      photo(
        `${potholeId}-before-2`,
        'before',
        IMG.potholeBeforeAlt,
        ago(now, 41),
        'Co-reporter',
        potholeLocation,
        'Same crater after overnight rain, water-filled.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'PWD/Roads',
    assignedOfficer: 'AE-PWD-KOR-114',
    routingHistory: [
      routingEvent(
        `${potholeId}-route-1`,
        potholeId,
        null,
        'PWD/Roads',
        'initial-triage',
        'Pothole on an arterial carriageway — road maintenance jurisdiction.',
        'TriageRouting agent',
        ago(now, 51.9),
      ),
    ],
    civicEye: {
      category: 'Pothole',
      confidence: 94,
      observation:
        'Large asphalt cavity roughly 1.2 m across and 18 cm deep in the near-side lane, with exposed aggregate and crumbling edges. Standing water obscures the base.',
      detectedObjects: ['asphalt cavity', 'standing water', 'lane marking', 'two-wheeler', 'kerb'],
      suggestedSeverity: 'High',
      hazardIndicators: [
        'Depth exceeds 15 cm',
        'Located in a moving traffic lane',
        'Water-filled — depth not visible to riders',
      ],
      alternatives: [
        { category: 'Damaged road', confidence: 61 },
        { category: 'Water leakage', confidence: 12 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 51.95),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 15,
      urgencyEscalations: 1,
      rationale:
        '14 further reports landed within 75 m of this pin over 50 hours, all classified Pothole. They were merged into this master civic issue and the severity was raised High → Very High on crowd corroboration.',
      decidedAt: ago(now, 51.9),
    },
    triage: {
      department: 'PWD/Roads',
      severity: 'Very High',
      slaHours: SLA_HOURS['Very High'],
      routingConfidence: 96,
      rationale:
        'Pothole on a BBMP arterial road maps to PWD/Roads. Severity lifted one band because 15 citizens are affected on an active bus and school route.',
      severitySignals: [
        'Arterial road with high two-wheeler volume',
        'Impact counter at 15 citizens',
        'Reported skid incident in co-reporter notes',
      ],
      appliedOverrideId: null,
      zoneKey: 'Koramangala:BBMP-South',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 51.9),
    },
    sla: buildSla(now, 'Very High', ago(now, 51.9), {
      escalationLevel: 1,
      escalatedTo: 'Assistant Executive Engineer — PWD Koramangala',
      escalationBriefing:
        'CIVIC-2026-004821 breached its 12 h Very High window with 15 citizens attached. Ward engineer notified; asphalt patching crew requested.',
    }),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['arterial-road', 'monsoon-risk', 'high-impact', 'school-route'],
    createdAt: potholeCreated,
    updatedAt: ago(now, 3),
    resolvedAt: null,
  };

  /** Two of the merged duplicate rows, kept so no co-reporter is ever lost. */
  const potholeDuplicateA: CivicTicket = {
    ...pothole,
    id: 'tkt-koramangala-pothole-dup-a',
    referenceCode: 'CIVIC-2026-004822',
    title: 'Bad pothole on 80 Ft Road',
    description:
      'Huge pit on the road near the signal, my scooter almost went down. Please do something.',
    status: 'Triaged',
    severity: 'High',
    location: { ...potholeLocation, lat: 12.93546, lng: 77.62472, accuracyMeters: 14 },
    reporter: reporter('9900451128', 'Koramangala'),
    inputModes: ['photo', 'map-pin'],
    voiceTranscript: null,
    isMaster: false,
    masterTicketId: potholeId,
    supporters: [],
    impactCount: 1,
    beforePhotos: [
      photo(
        'tkt-koramangala-pothole-dup-a-before-1',
        'before',
        IMG.potholeBeforeAlt,
        ago(now, 44),
        'Citizen #1174',
        potholeLocation,
        'Duplicate report, 31 m from the master pin.',
      ),
    ],
    routingHistory: [],
    dedup: {
      outcome: 'merged',
      masterTicketId: potholeId,
      radiusMeters: 75,
      candidates: [
        {
          ticketId: potholeId,
          referenceCode: 'CIVIC-2026-004821',
          category: 'Pothole',
          distanceMeters: 31,
          ageHours: 8,
          matchScore: 92,
        },
      ],
      impactCount: 15,
      urgencyEscalations: 0,
      rationale:
        'Same category, 31 m from an open master ticket raised 8 h earlier. Folded into CIVIC-2026-004821 and the reporter was attached as a co-reporter.',
      decidedAt: ago(now, 43.9),
    },
    triage: null,
    sla: buildSla(now, 'High', ago(now, 43.9)),
    auditLog: [],
    tags: ['merged-duplicate'],
    createdAt: ago(now, 44),
    updatedAt: ago(now, 43.9),
  };

  const potholeDuplicateB: CivicTicket = {
    ...potholeDuplicateA,
    id: 'tkt-koramangala-pothole-dup-b',
    referenceCode: 'CIVIC-2026-004829',
    title: 'Road pit near Sony World bus stop',
    description: 'Gaddi tumba doddadu ide — big pit near the bus stop, buses are jolting badly.',
    language: 'kn',
    location: { ...potholeLocation, lat: 12.93489, lng: 77.62419, accuracyMeters: 11 },
    reporter: reporter('8971203344', 'Koramangala'),
    inputModes: ['voice', 'map-pin'],
    voiceTranscript: 'Sony World bus stop hattira dodda gaddi ide, bus tumba jerk aaguttide.',
    beforePhotos: [],
    dedup: {
      outcome: 'merged',
      masterTicketId: potholeId,
      radiusMeters: 75,
      candidates: [
        {
          ticketId: potholeId,
          referenceCode: 'CIVIC-2026-004821',
          category: 'Pothole',
          distanceMeters: 48,
          ageHours: 33,
          matchScore: 85,
        },
      ],
      impactCount: 15,
      urgencyEscalations: 0,
      rationale:
        'Kannada voice report, 48 m from the master pin. Merged into CIVIC-2026-004821 rather than opening a 16th ticket.',
      decidedAt: ago(now, 18.9),
    },
    sla: buildSla(now, 'High', ago(now, 18.9)),
    createdAt: ago(now, 19),
    updatedAt: ago(now, 18.9),
  };

  /* ----------------------------------------------------------------------- */
  /* 2. Ejipura garbage black spot — SLA warning territory.                  */
  /* ----------------------------------------------------------------------- */

  const garbageId = 'tkt-ejipura-garbage';
  const garbageLocation: GeoPoint = {
    lat: 12.9412,
    lng: 77.6265,
    accuracyMeters: 10,
    address: 'Ejipura Main Road, opposite the vegetable market, Ward 148',
    ward: 'Ejipura',
    zone: 'BBMP-South',
  };

  const garbage: CivicTicket = {
    id: garbageId,
    referenceCode: 'CIVIC-2026-004826',
    title: 'Garbage black spot outside Ejipura vegetable market',
    description:
      'Uncleared heap of mixed household and market waste spilling onto the footpath and half the carriageway. Stray dogs have scattered it across the junction and the smell is unbearable by midday.',
    category: 'Garbage accumulation',
    status: 'Assigned',
    severity: 'High',
    location: garbageLocation,
    reporter: reporter('9663312078', 'Ejipura'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, garbageId, 9, 'Ejipura', 26),
    impactCount: 10,
    beforePhotos: [
      photo(
        `${garbageId}-before-1`,
        'before',
        IMG.garbageBefore,
        ago(now, 27),
        'Citizen #2078',
        garbageLocation,
        'Heap spilling onto the carriageway.',
      ),
      photo(
        `${garbageId}-before-2`,
        'before',
        IMG.garbageBeforeAlt,
        ago(now, 14),
        'Co-reporter',
        garbageLocation,
        'Scattered further by strays overnight.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'Sanitation',
    assignedOfficer: 'SWM-MARSHAL-148',
    routingHistory: [
      routingEvent(
        `${garbageId}-route-1`,
        garbageId,
        null,
        'Sanitation',
        'initial-triage',
        'Mixed municipal solid waste — Solid Waste Management jurisdiction.',
        'TriageRouting agent',
        ago(now, 26.9),
      ),
    ],
    civicEye: {
      category: 'Garbage accumulation',
      confidence: 91,
      observation:
        'Large heap of mixed municipal solid waste, roughly 3 m wide, encroaching on the footpath and the near lane. Organic market waste is visible alongside plastic.',
      detectedObjects: ['refuse heap', 'plastic bags', 'organic waste', 'footpath', 'stray dog'],
      suggestedSeverity: 'Medium',
      hazardIndicators: [
        'Blocking pedestrian footpath',
        'Organic waste — vector and stray-animal risk',
        'Adjacent to a food market',
      ],
      alternatives: [
        { category: 'Overflowing drain', confidence: 22 },
        { category: 'Traffic obstruction', confidence: 17 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 26.95),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 10,
      urgencyEscalations: 1,
      rationale:
        '9 additional reports inside the 75 m radius were merged. Severity raised Medium → High: public-health exposure next to a food market with 10 citizens attached.',
      decidedAt: ago(now, 26.9),
    },
    triage: {
      department: 'Sanitation',
      severity: 'High',
      slaHours: SLA_HOURS.High,
      routingConfidence: 97,
      rationale:
        'Municipal solid waste routes to Sanitation. Severity lifted for public-health proximity to a vegetable market.',
      severitySignals: [
        'Adjacent to a food market',
        'Footpath fully obstructed',
        'Impact counter at 10 citizens',
      ],
      appliedOverrideId: null,
      zoneKey: 'Ejipura:BBMP-South',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 26.9),
    },
    sla: buildSla(now, 'High', ago(now, 26.9), {
      escalationLevel: 1,
      escalatedTo: 'Zonal Commissioner — Solid Waste Management',
      escalationBriefing:
        'CIVIC-2026-004826 crossed its 24 h Sanitation window. Ward 148 marshal has not filed pickup proof. 10 citizens attached; market-adjacent public-health risk.',
    }),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['black-spot', 'public-health', 'market-adjacent'],
    createdAt: ago(now, 27),
    updatedAt: ago(now, 2),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 3. Emergency electrical hazard — 2 h SLA, breached, auto-escalated.     */
  /* ----------------------------------------------------------------------- */

  const hazardId = 'tkt-btm-electrical-hazard';
  const hazardLocation: GeoPoint = {
    lat: 12.9166,
    lng: 77.6101,
    accuracyMeters: 6,
    address: '16th Main, BTM Layout 2nd Stage, beside the transformer yard',
    ward: 'BTM Layout',
    zone: 'BBMP-South',
  };

  const hazard: CivicTicket = {
    id: hazardId,
    referenceCode: 'CIVIC-2026-004830',
    title: 'EMERGENCY: snapped streetlight pole with live sparking cable',
    description:
      'A streetlight pole sheared at the base and the supply cable is hanging at head height, sparking intermittently onto a wet footpath. Children use this stretch to reach the park. Nobody has cordoned it off.',
    category: 'Broken streetlight',
    status: 'In Progress',
    severity: 'Emergency',
    location: hazardLocation,
    reporter: reporter('9880233914', 'BTM Layout'),
    language: 'en',
    inputModes: ['photo', 'voice', 'text', 'map-pin'],
    voiceTranscript:
      'Urgent, there is a live wire hanging near the transformer in BTM second stage. It is sparking and the ground is wet. Please send somebody immediately.',
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, hazardId, 6, 'BTM Layout', 4),
    impactCount: 7,
    beforePhotos: [
      photo(
        `${hazardId}-before-1`,
        'before',
        IMG.electricalHazard,
        ago(now, 4.2),
        'Citizen #3914',
        hazardLocation,
        'Snapped pole, cable at head height over a wet footpath.',
      ),
      photo(
        `${hazardId}-before-2`,
        'before',
        IMG.streetlightBefore,
        ago(now, 3.6),
        'Co-reporter',
        hazardLocation,
        'Wider shot showing the unlit stretch toward the park.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'Electricity/BESCOM',
    assignedOfficer: 'BESCOM-EE-BTM-07',
    routingHistory: [
      routingEvent(
        `${hazardId}-route-1`,
        hazardId,
        null,
        'Electricity/BESCOM',
        'initial-triage',
        'Live low-tension conductor — BESCOM emergency restoration.',
        'TriageRouting agent',
        ago(now, 4.15),
      ),
      routingEvent(
        `${hazardId}-route-2`,
        hazardId,
        'Electricity/BESCOM',
        'Electricity/BESCOM',
        'escalation',
        'SLA breach at 2 h. Escalated to the Executive Engineer with an auto-briefing.',
        'SlaSentinel agent',
        ago(now, 2.1),
      ),
    ],
    civicEye: {
      category: 'Broken streetlight',
      confidence: 97,
      observation:
        'Street lighting pole fractured at the base plate. An insulated conductor has pulled free and hangs roughly 1.7 m above a wet footpath, with visible arcing at the break.',
      detectedObjects: [
        'fractured pole',
        'hanging conductor',
        'electrical arcing',
        'wet footpath',
        'transformer enclosure',
      ],
      suggestedSeverity: 'Emergency',
      hazardIndicators: [
        'Live conductor at pedestrian head height',
        'Visible arcing',
        'Wet ground — electrocution path',
        'No barricade present',
        'Route used by children',
      ],
      alternatives: [
        { category: 'Damaged public infrastructure', confidence: 58 },
        { category: 'Traffic obstruction', confidence: 9 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 4.18),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 7,
      urgencyEscalations: 0,
      rationale:
        '6 reports merged within 75 m in under 4 hours. Severity was already Emergency on the hazard signature, so no further crowd escalation was applied.',
      decidedAt: ago(now, 4.15),
    },
    triage: {
      department: 'Electricity/BESCOM',
      severity: 'Emergency',
      slaHours: SLA_HOURS.Emergency,
      routingConfidence: 99,
      rationale:
        'Live-conductor hazard is an unconditional Emergency. Routed straight to BESCOM emergency restoration, bypassing the standard ward queue.',
      severitySignals: [
        'Live conductor at head height',
        'Visible arcing onto wet ground',
        'Pedestrian route used by children',
        'No barricade in place',
      ],
      appliedOverrideId: null,
      zoneKey: 'BTM Layout:BBMP-South',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 4.15),
    },
    sla: buildSla(now, 'Emergency', ago(now, 4.15), {
      escalationLevel: 2,
      escalatedTo: 'Executive Engineer — BESCOM Sub-Division',
      escalationBriefing:
        'AUTO-BRIEFING — CIVIC-2026-004830 breached its 2 h Emergency window. Live low-tension conductor at 1.7 m over a wet footpath, 16th Main BTM 2nd Stage. 7 citizens attached, 6 within 4 h. No barricade reported. Recommend immediate feeder isolation and on-site cordon before a restoration crew is dispatched.',
    }),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['emergency', 'live-wire', 'auto-escalated', 'child-safety'],
    createdAt: ago(now, 4.2),
    updatedAt: ago(now, 0.5),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 4. HSR drain — the self-healing routing story.                          */
  /*    Mis-routed to Sanitation, corrected by the authority to BWSSB.       */
  /* ----------------------------------------------------------------------- */

  const drainId = 'tkt-hsr-drain';
  const drainLocation: GeoPoint = {
    lat: 12.9121,
    lng: 77.6446,
    accuracyMeters: 9,
    address: '17th Main, HSR Layout Sector 2, near the storm-water culvert',
    ward: 'HSR Layout',
    zone: 'BBMP-Bommanahalli',
  };

  const drain: CivicTicket = {
    id: drainId,
    referenceCode: 'CIVIC-2026-004818',
    title: 'Storm-water drain overflowing across 17th Main',
    description:
      'The culvert on 17th Main is choked and sewage-mixed water is running across the full width of the road. It has been like this for three days and residents are wading through it.',
    category: 'Overflowing drain',
    status: 'Pending Citizen Confirmation',
    severity: 'Very High',
    location: drainLocation,
    reporter: reporter('9743028816', 'HSR Layout'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, drainId, 11, 'HSR Layout', 70),
    impactCount: 12,
    beforePhotos: [
      photo(
        `${drainId}-before-1`,
        'before',
        IMG.drainBefore,
        ago(now, 74),
        'Citizen #8816',
        drainLocation,
        'Culvert choked, water across the full carriageway.',
      ),
    ],
    afterPhotos: [
      photo(
        `${drainId}-after-1`,
        'after',
        IMG.drainAfter,
        ago(now, 6),
        'BWSSB-AEE-HSR-22',
        drainLocation,
        'Culvert de-silted and flow restored. Same culvert head and compound wall visible.',
      ),
    ],
    assignedDepartment: 'Water/Jal Board',
    assignedOfficer: 'BWSSB-AEE-HSR-22',
    routingHistory: [
      routingEvent(
        `${drainId}-route-1`,
        drainId,
        null,
        'Sanitation',
        'initial-triage',
        'Initial classification read the blockage as solid-waste choking.',
        'TriageRouting agent',
        ago(now, 73.9),
      ),
      routingEvent(
        `${drainId}-route-2`,
        drainId,
        'Sanitation',
        'Water/Jal Board',
        'authority-reroute',
        'Wrong Department: sewage ingress into the storm-water line is a BWSSB subject, not SWM.',
        'SWM Ward Marshal, HSR Layout',
        ago(now, 69.4),
      ),
    ],
    civicEye: {
      category: 'Overflowing drain',
      confidence: 89,
      observation:
        'Storm-water culvert head submerged, with grey turbid water sheeting across the carriageway and silt deposits along the kerb line.',
      detectedObjects: ['culvert head', 'turbid water', 'silt deposit', 'kerb', 'compound wall'],
      suggestedSeverity: 'Very High',
      hazardIndicators: [
        'Sewage-mixed water on a residential road',
        'Standing water for three days',
        'Pedestrians wading through the flow',
      ],
      alternatives: [
        { category: 'Water leakage', confidence: 47 },
        { category: 'Garbage accumulation', confidence: 26 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 73.95),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 12,
      urgencyEscalations: 1,
      rationale: '11 reports merged inside the 75 m radius over three days.',
      decidedAt: ago(now, 73.9),
    },
    triage: {
      department: 'Water/Jal Board',
      severity: 'Very High',
      slaHours: SLA_HOURS['Very High'],
      routingConfidence: 88,
      rationale:
        'Re-routed by the ward marshal from Sanitation to Water/Jal Board. The correction was written to the self-healing graph, so Overflowing drain reports in HSR Layout now go to BWSSB on the first hop.',
      severitySignals: [
        'Sewage ingress into a storm-water line',
        'Three days of standing water',
        'Impact counter at 12 citizens',
      ],
      appliedOverrideId: 'override-hsr-drain',
      zoneKey: 'HSR Layout:BBMP-Bommanahalli',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 69.4),
    },
    sla: buildSla(now, 'Very High', ago(now, 69.4), {
      resolvedAtIso: ago(now, 6),
    }),
    proof: {
      verdict: 'verified',
      confidence: 93,
      landmarkMatch: 95,
      repairEvidence: 91,
      landmarksMatched: [
        'Culvert head and grating geometry',
        'Compound wall with the same paint band',
        'Kerb stone alignment and utility pole position',
      ],
      discrepancies: ['Lighting differs (morning vs. late afternoon)'],
      summary:
        'Both frames share the culvert head, compound wall paint band and utility pole placement, confirming the same location. The standing water and silt line present in the before frame are absent and the grating is clear, so the de-silting is genuine.',
      beforePhotoId: `${drainId}-before-1`,
      afterPhotoId: `${drainId}-after-1`,
      submittedBy: 'BWSSB-AEE-HSR-22',
      model: 'pixtral-12b-2409',
      mode: 'mock',
      verifiedAt: ago(now, 5.9),
    },
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['self-healing', 'rerouted', 'proof-verified', 'awaiting-citizen'],
    createdAt: ago(now, 74),
    updatedAt: ago(now, 5.9),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 5. Indiranagar water leak — fully closed loop with citizen sign-off.    */
  /* ----------------------------------------------------------------------- */

  const leakId = 'tkt-indiranagar-leak';
  const leakLocation: GeoPoint = {
    lat: 12.9719,
    lng: 77.6412,
    accuracyMeters: 7,
    address: '100 Feet Road, near the Indiranagar metro pillar 312',
    ward: 'Indiranagar',
    zone: 'BBMP-East',
  };

  const leak: CivicTicket = {
    id: leakId,
    referenceCode: 'CIVIC-2026-004815',
    title: 'Mains leak flooding the footpath at metro pillar 312',
    description:
      'A pressurised leak in the water main has been throwing water across the footpath for two days. The paver blocks have sunk and the whole stretch is slippery.',
    category: 'Water leakage',
    status: 'Resolved',
    severity: 'Very High',
    location: leakLocation,
    reporter: reporter('9845667201', 'Indiranagar'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, leakId, 7, 'Indiranagar', 96),
    impactCount: 8,
    beforePhotos: [
      photo(
        `${leakId}-before-1`,
        'before',
        IMG.waterLeakBefore,
        ago(now, 98),
        'Citizen #7201',
        leakLocation,
        'Pressurised leak flooding the footpath.',
      ),
    ],
    afterPhotos: [
      photo(
        `${leakId}-after-1`,
        'after',
        IMG.waterLeakAfter,
        ago(now, 79),
        'BWSSB-JE-IND-08',
        leakLocation,
        'Valve replaced, footpath re-laid, surface dry.',
      ),
    ],
    assignedDepartment: 'Water/Jal Board',
    assignedOfficer: 'BWSSB-JE-IND-08',
    routingHistory: [
      routingEvent(
        `${leakId}-route-1`,
        leakId,
        null,
        'Water/Jal Board',
        'initial-triage',
        'Pressurised potable-water leak — BWSSB distribution network.',
        'TriageRouting agent',
        ago(now, 97.9),
      ),
    ],
    civicEye: {
      category: 'Water leakage',
      confidence: 96,
      observation:
        'Continuous pressurised discharge from beneath a paver-block footpath, with sunken blocks and a persistent wet sheet spreading toward the kerb.',
      detectedObjects: ['water jet', 'paver blocks', 'subsidence', 'metro pillar', 'kerb'],
      suggestedSeverity: 'Very High',
      hazardIndicators: [
        'Potable water loss under pressure',
        'Footpath subsidence',
        'Slip hazard on a high-footfall stretch',
      ],
      alternatives: [
        { category: 'Overflowing drain', confidence: 31 },
        { category: 'Damaged road', confidence: 19 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 97.95),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 8,
      urgencyEscalations: 0,
      rationale: '7 reports merged inside the 75 m radius within the first day.',
      decidedAt: ago(now, 97.9),
    },
    triage: {
      department: 'Water/Jal Board',
      severity: 'Very High',
      slaHours: SLA_HOURS['Very High'],
      routingConfidence: 98,
      rationale: 'Pressurised mains leak routes directly to the BWSSB distribution crew.',
      severitySignals: [
        'Treated water loss under pressure',
        'Footpath subsidence',
        'High-footfall commercial stretch',
      ],
      appliedOverrideId: null,
      zoneKey: 'Indiranagar:BBMP-East',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 97.9),
    },
    sla: buildSla(now, 'Very High', ago(now, 97.9), { resolvedAtIso: ago(now, 88) }),
    proof: {
      verdict: 'verified',
      confidence: 96,
      landmarkMatch: 97,
      repairEvidence: 95,
      landmarksMatched: [
        'Metro pillar 312 with its stencilled number',
        'Shopfront shutter line in the background',
        'Kerb ramp and bollard spacing',
      ],
      discrepancies: [],
      summary:
        'Pillar 312, the shutter line and the bollard spacing are identical across both frames. The discharge and the sunken paver depression are gone and the surface is dry and relaid, so the repair is genuine.',
      beforePhotoId: `${leakId}-before-1`,
      afterPhotoId: `${leakId}-after-1`,
      submittedBy: 'BWSSB-JE-IND-08',
      model: 'pixtral-12b-2409',
      mode: 'mock',
      verifiedAt: ago(now, 78.9),
    },
    citizenConfirmation: {
      decision: 'approved',
      rating: 5,
      praiseChips: ['⚡ Super Fast', '🛡️ High Quality'],
      comment: 'Fixed properly and the footpath was relaid. Took two days, which is fair.',
      confirmedBy: pseudonymFor('9845667201'),
      confirmedAt: ago(now, 76),
    },
    bounty: null,
    auditLog: [],
    tags: ['closed-loop', 'proof-verified', 'citizen-approved'],
    createdAt: ago(now, 98),
    updatedAt: ago(now, 76),
    resolvedAt: ago(now, 88),
  };

  /* ----------------------------------------------------------------------- */
  /* 6. Jayanagar fallen tree — fresh, on track.                             */
  /* ----------------------------------------------------------------------- */

  const treeId = 'tkt-jayanagar-tree';
  const treeLocation: GeoPoint = {
    lat: 12.925,
    lng: 77.5938,
    accuracyMeters: 12,
    address: '11th Main, Jayanagar 4th Block, opposite the park gate',
    ward: 'Jayanagar',
    zone: 'BBMP-South',
  };

  const tree: CivicTicket = {
    id: treeId,
    referenceCode: 'CIVIC-2026-004833',
    title: 'Rain tree down across 11th Main',
    description:
      'A large rain tree came down in last night’s wind and is lying across both lanes with branches on two parked cars. The road is completely cut off.',
    category: 'Fallen tree',
    status: 'Assigned',
    severity: 'Very High',
    location: treeLocation,
    reporter: reporter('9019887432', 'Jayanagar'),
    language: 'en',
    inputModes: ['photo', 'voice', 'map-pin'],
    voiceTranscript:
      'Big tree has fallen on eleventh main Jayanagar fourth block, road is fully blocked, two cars are damaged.',
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, treeId, 5, 'Jayanagar', 7),
    impactCount: 6,
    beforePhotos: [
      photo(
        `${treeId}-before-1`,
        'before',
        IMG.treeBefore,
        ago(now, 7.4),
        'Citizen #7432',
        treeLocation,
        'Trunk across both lanes, branches over parked cars.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'PWD/Roads',
    assignedOfficer: 'BBMP-HORT-JAY-03',
    routingHistory: [
      routingEvent(
        `${treeId}-route-1`,
        treeId,
        null,
        'PWD/Roads',
        'initial-triage',
        'Carriageway obstruction requiring cutting and clearance.',
        'TriageRouting agent',
        ago(now, 7.3),
      ),
    ],
    civicEye: {
      category: 'Fallen tree',
      confidence: 95,
      observation:
        'Mature tree uprooted at the base, trunk spanning the full carriageway with the canopy resting on parked vehicles. No power lines appear to be involved.',
      detectedObjects: ['uprooted trunk', 'canopy', 'parked car', 'road surface', 'park railing'],
      suggestedSeverity: 'Very High',
      hazardIndicators: [
        'Full carriageway blocked',
        'Property damage in progress',
        'Emergency-vehicle access cut off',
      ],
      alternatives: [
        { category: 'Traffic obstruction', confidence: 68 },
        { category: 'Damaged public infrastructure', confidence: 14 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 7.35),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 6,
      urgencyEscalations: 0,
      rationale: '5 reports merged inside the 75 m radius within 7 hours of the storm.',
      decidedAt: ago(now, 7.3),
    },
    triage: {
      department: 'PWD/Roads',
      severity: 'Very High',
      slaHours: SLA_HOURS['Very High'],
      routingConfidence: 92,
      rationale:
        'Tree clearance on a carriageway is handled by the PWD/Roads clearance crew with horticulture support.',
      severitySignals: [
        'Both lanes blocked',
        'Emergency-vehicle access cut off',
        'Active property damage',
      ],
      appliedOverrideId: null,
      zoneKey: 'Jayanagar:BBMP-South',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 7.3),
    },
    sla: buildSla(now, 'Very High', ago(now, 7.3)),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['storm-damage', 'road-blocked'],
    createdAt: ago(now, 7.4),
    updatedAt: ago(now, 1.2),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 7. Silk Board traffic obstruction.                                      */
  /* ----------------------------------------------------------------------- */

  const trafficId = 'tkt-silkboard-obstruction';
  const trafficLocation: GeoPoint = {
    lat: 12.9172,
    lng: 77.6229,
    accuracyMeters: 15,
    address: 'Silk Board Junction, Hosur Road approach',
    ward: 'BTM Layout',
    zone: 'BBMP-Bommanahalli',
  };

  const traffic: CivicTicket = {
    id: trafficId,
    referenceCode: 'CIVIC-2026-004835',
    title: 'Abandoned barricades narrowing the Hosur Road approach',
    description:
      'Metro construction barricades were left across one and a half lanes after the work finished. Peak-hour traffic is backing up almost a kilometre because of it.',
    category: 'Traffic obstruction',
    status: 'Triaged',
    severity: 'High',
    location: trafficLocation,
    reporter: reporter('9535612940', 'BTM Layout'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, trafficId, 8, 'BTM Layout', 11),
    impactCount: 9,
    beforePhotos: [
      photo(
        `${trafficId}-before-1`,
        'before',
        IMG.trafficBefore,
        ago(now, 11.5),
        'Citizen #2940',
        trafficLocation,
        'Barricades occupying the left lane and shoulder.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'Traffic',
    assignedOfficer: null,
    routingHistory: [
      routingEvent(
        `${trafficId}-route-1`,
        trafficId,
        null,
        'Traffic',
        'initial-triage',
        'Carriageway obstruction on a signalised junction approach.',
        'TriageRouting agent',
        ago(now, 11.4),
      ),
    ],
    civicEye: {
      category: 'Traffic obstruction',
      confidence: 88,
      observation:
        'Row of construction barricades and loose debris occupying the left lane and shoulder on the junction approach, with queued vehicles merging right.',
      detectedObjects: ['barricade', 'construction debris', 'queued vehicles', 'lane marking'],
      suggestedSeverity: 'High',
      hazardIndicators: [
        'Lane capacity reduced at a junction approach',
        'Forced late merge',
        'Peak-hour queue formation',
      ],
      alternatives: [
        { category: 'Damaged public infrastructure', confidence: 34 },
        { category: 'Damaged road', confidence: 21 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 11.45),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 9,
      urgencyEscalations: 0,
      rationale: '8 reports merged inside the 75 m radius across the morning peak.',
      decidedAt: ago(now, 11.4),
    },
    triage: {
      department: 'Traffic',
      severity: 'High',
      slaHours: SLA_HOURS.High,
      routingConfidence: 84,
      rationale:
        'Obstruction on a junction approach routes to Traffic for clearance coordination with the construction contractor.',
      severitySignals: ['Peak-hour junction approach', 'Impact counter at 9 citizens'],
      appliedOverrideId: null,
      zoneKey: 'BTM Layout:BBMP-Bommanahalli',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 11.4),
    },
    sla: buildSla(now, 'High', ago(now, 11.4)),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['peak-hour', 'contractor-debris'],
    createdAt: ago(now, 11.5),
    updatedAt: ago(now, 11.4),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 8. Whitefield streetlight — closed, proof verified.                     */
  /* ----------------------------------------------------------------------- */

  const lightId = 'tkt-whitefield-streetlight';
  const lightLocation: GeoPoint = {
    lat: 12.9698,
    lng: 77.75,
    accuracyMeters: 11,
    address: 'ITPL Main Road, Whitefield, near the Hope Farm underpass',
    ward: 'Whitefield',
    zone: 'BBMP-Mahadevapura',
  };

  const light: CivicTicket = {
    id: lightId,
    referenceCode: 'CIVIC-2026-004812',
    title: 'Dark stretch — eight streetlights out near Hope Farm',
    description:
      'An entire 300 m stretch has been unlit for over a week. Women walking back from the bus stop after 9 pm have flagged it repeatedly.',
    category: 'Broken streetlight',
    status: 'Resolved',
    severity: 'High',
    location: lightLocation,
    reporter: reporter('9741230065', 'Whitefield'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, lightId, 12, 'Whitefield', 140),
    impactCount: 13,
    beforePhotos: [
      photo(
        `${lightId}-before-1`,
        'before',
        IMG.streetlightBefore,
        ago(now, 146),
        'Citizen #0065',
        lightLocation,
        'Unlit stretch toward the underpass at 21:10.',
      ),
    ],
    afterPhotos: [
      photo(
        `${lightId}-after-1`,
        'after',
        IMG.streetlightAfter,
        ago(now, 122),
        'BESCOM-LM-WFD-19',
        lightLocation,
        'All eight fittings restored, same stretch at 20:55.',
      ),
    ],
    assignedDepartment: 'Electricity/BESCOM',
    assignedOfficer: 'BESCOM-LM-WFD-19',
    routingHistory: [
      routingEvent(
        `${lightId}-route-1`,
        lightId,
        null,
        'Electricity/BESCOM',
        'initial-triage',
        'Street lighting fault — BESCOM line maintenance.',
        'TriageRouting agent',
        ago(now, 145.8),
      ),
    ],
    civicEye: {
      category: 'Broken streetlight',
      confidence: 90,
      observation:
        'Night frame showing a continuous unlit stretch with intact but dark fittings on both sides of the carriageway. No conductor damage is visible.',
      detectedObjects: ['street light pole', 'dark fitting', 'carriageway', 'underpass entrance'],
      suggestedSeverity: 'High',
      hazardIndicators: [
        'Unlit pedestrian route after dark',
        'Sustained over a week',
        'Adjacent to a bus stop',
      ],
      alternatives: [{ category: 'Damaged public infrastructure', confidence: 29 }],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 145.85),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 13,
      urgencyEscalations: 1,
      rationale:
        '12 reports merged inside the 75 m radius over six days. Severity raised on safety grounds for an unlit pedestrian route.',
      decidedAt: ago(now, 145.8),
    },
    triage: {
      department: 'Electricity/BESCOM',
      severity: 'High',
      slaHours: SLA_HOURS.High,
      routingConfidence: 95,
      rationale: 'Street lighting outage routes to BESCOM line maintenance for the Whitefield feeder.',
      severitySignals: [
        'Unlit pedestrian route after dark',
        'Impact counter at 13 citizens',
        'Repeated night-safety reports',
      ],
      appliedOverrideId: null,
      zoneKey: 'Whitefield:BBMP-Mahadevapura',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 145.8),
    },
    sla: buildSla(now, 'High', ago(now, 145.8), { resolvedAtIso: ago(now, 124) }),
    proof: {
      verdict: 'verified',
      confidence: 91,
      landmarkMatch: 93,
      repairEvidence: 89,
      landmarksMatched: [
        'Underpass entrance arch',
        'Pole spacing and the same median railing',
        'Hoarding frame on the left shoulder',
      ],
      discrepancies: ['After frame taken 15 minutes earlier in the evening'],
      summary:
        'The underpass arch, pole spacing and hoarding frame align across both frames. Every fitting that was dark in the before image is lit in the after image, so the restoration is genuine.',
      beforePhotoId: `${lightId}-before-1`,
      afterPhotoId: `${lightId}-after-1`,
      submittedBy: 'BESCOM-LM-WFD-19',
      model: 'pixtral-12b-2409',
      mode: 'mock',
      verifiedAt: ago(now, 121.9),
    },
    citizenConfirmation: {
      decision: 'approved',
      rating: 4,
      praiseChips: ['🧹 Spotless Finish'],
      comment: 'Lights are back. Took a week to start, but the whole stretch is working now.',
      confirmedBy: pseudonymFor('9741230065'),
      confirmedAt: ago(now, 118),
    },
    bounty: null,
    auditLog: [],
    tags: ['night-safety', 'closed-loop', 'proof-verified'],
    createdAt: ago(now, 146),
    updatedAt: ago(now, 118),
    resolvedAt: ago(now, 124),
  };

  /* ----------------------------------------------------------------------- */
  /* 9. Marathahalli — a fraudulent proof that CivicProof rejected.          */
  /* ----------------------------------------------------------------------- */

  const roadId = 'tkt-marathahalli-road';
  const roadLocation: GeoPoint = {
    lat: 12.9591,
    lng: 77.6974,
    accuracyMeters: 13,
    address: 'Outer Ring Road service lane, below Marathahalli bridge',
    ward: 'Marathahalli',
    zone: 'BBMP-Mahadevapura',
  };

  const road: CivicTicket = {
    id: roadId,
    referenceCode: 'CIVIC-2026-004808',
    title: 'Service lane surface completely broken up under the bridge',
    description:
      'The service lane below the bridge has lost its surface over a 60 m stretch. It is loose gravel and exposed rebar now, and it is the only route to the apartments behind.',
    category: 'Damaged road',
    status: 'In Progress',
    severity: 'High',
    location: roadLocation,
    reporter: reporter('9886554120', 'Marathahalli'),
    language: 'en',
    inputModes: ['photo', 'text', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, roadId, 10, 'Marathahalli', 190),
    impactCount: 11,
    beforePhotos: [
      photo(
        `${roadId}-before-1`,
        'before',
        IMG.roadBefore,
        ago(now, 196),
        'Citizen #4120',
        roadLocation,
        'Surface lost across the full service-lane width.',
      ),
    ],
    afterPhotos: [
      photo(
        `${roadId}-after-1`,
        'after',
        IMG.infraAfter,
        ago(now, 30),
        'PWD-JE-MRT-11',
        null,
        'Submitted as completion proof — rejected by CivicProof.',
      ),
    ],
    assignedDepartment: 'PWD/Roads',
    assignedOfficer: 'PWD-JE-MRT-11',
    routingHistory: [
      routingEvent(
        `${roadId}-route-1`,
        roadId,
        null,
        'PWD/Roads',
        'initial-triage',
        'Carriageway surface failure — road maintenance jurisdiction.',
        'TriageRouting agent',
        ago(now, 195.8),
      ),
    ],
    civicEye: {
      category: 'Damaged road',
      confidence: 92,
      observation:
        'Bituminous surface stripped across the full lane width for an extended stretch, exposing base course aggregate and sections of reinforcement.',
      detectedObjects: ['exposed aggregate', 'rebar', 'bridge pier', 'service lane', 'gravel'],
      suggestedSeverity: 'High',
      hazardIndicators: [
        'Exposed reinforcement',
        'Sole access route to a residential cluster',
        'Loose gravel on a used carriageway',
      ],
      alternatives: [
        { category: 'Pothole', confidence: 57 },
        { category: 'Damaged public infrastructure', confidence: 38 },
      ],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 195.85),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 11,
      urgencyEscalations: 0,
      rationale: '10 reports merged inside the 75 m radius over eight days.',
      decidedAt: ago(now, 195.8),
    },
    triage: {
      department: 'PWD/Roads',
      severity: 'High',
      slaHours: SLA_HOURS.High,
      routingConfidence: 94,
      rationale: 'Carriageway surface failure routes to the PWD/Roads Mahadevapura division.',
      severitySignals: ['Exposed reinforcement', 'Sole access route to residences'],
      appliedOverrideId: null,
      zoneKey: 'Marathahalli:BBMP-Mahadevapura',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 195.8),
    },
    sla: buildSla(now, 'High', ago(now, 195.8), {
      escalationLevel: 2,
      escalatedTo: 'Chief Engineer — Roads & Infrastructure',
      escalationBriefing:
        'CIVIC-2026-004808 is 8x past its 24 h window. A closure attempt was rejected by CivicProof for mismatched evidence. 11 citizens attached. Recommend a site inspection before any further closure claim is accepted.',
    }),
    proof: {
      verdict: 'rejected',
      confidence: 27,
      landmarkMatch: 18,
      repairEvidence: 44,
      landmarksMatched: [],
      discrepancies: [
        'No bridge pier in the after frame, though it dominates the before frame',
        'Kerb profile and drainage channel do not correspond',
        'Building line in the background is absent',
        'After frame carries no geotag',
      ],
      summary:
        'The after photograph does not show the same location. None of the fixed landmarks from the before frame — bridge pier, kerb profile, background building line — are present, and the submission carries no geotag. Closure refused; the ticket stays open.',
      beforePhotoId: `${roadId}-before-1`,
      afterPhotoId: `${roadId}-after-1`,
      submittedBy: 'PWD-JE-MRT-11',
      model: 'pixtral-12b-2409',
      mode: 'mock',
      verifiedAt: ago(now, 29.9),
    },
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['proof-rejected', 'auto-escalated', 'fraud-attempt'],
    createdAt: ago(now, 196),
    updatedAt: ago(now, 29.9),
    resolvedAt: null,
  };

  /* ----------------------------------------------------------------------- */
  /* 10. Koramangala infrastructure — a low-severity long tail.              */
  /* ----------------------------------------------------------------------- */

  const infraId = 'tkt-koramangala-infra';
  const infraLocation: GeoPoint = {
    lat: 12.9368,
    lng: 77.6198,
    accuracyMeters: 10,
    address: '5th Block bus shelter, Koramangala',
    ward: 'Koramangala',
    zone: 'BBMP-South',
  };

  const infra: CivicTicket = {
    id: infraId,
    referenceCode: 'CIVIC-2026-004837',
    title: 'Bus shelter roof sheet torn away',
    description:
      'Half the roof sheeting of the 5th Block bus shelter has come off and the frame edge is sharp. People are waiting in the sun and rain.',
    category: 'Damaged public infrastructure',
    status: 'Submitted',
    severity: 'Medium',
    location: infraLocation,
    reporter: reporter('9900876513', 'Koramangala'),
    language: 'en',
    inputModes: ['photo', 'map-pin'],
    voiceTranscript: null,
    isMaster: true,
    masterTicketId: null,
    supporters: coReporters(now, infraId, 2, 'Koramangala', 3),
    impactCount: 3,
    beforePhotos: [
      photo(
        `${infraId}-before-1`,
        'before',
        IMG.infraBefore,
        ago(now, 3.2),
        'Citizen #6513',
        infraLocation,
        'Roof sheeting torn back, exposed frame edge.',
      ),
    ],
    afterPhotos: [],
    assignedDepartment: 'PWD/Roads',
    assignedOfficer: null,
    routingHistory: [
      routingEvent(
        `${infraId}-route-1`,
        infraId,
        null,
        'PWD/Roads',
        'initial-triage',
        'Street furniture repair — PWD/Roads maintenance.',
        'TriageRouting agent',
        ago(now, 3.1),
      ),
    ],
    civicEye: {
      category: 'Damaged public infrastructure',
      confidence: 86,
      observation:
        'Bus shelter with roughly half its roof sheeting detached and peeled back, leaving an exposed, sharp-edged steel frame over the waiting area.',
      detectedObjects: ['bus shelter', 'torn roof sheet', 'steel frame', 'bench', 'route board'],
      suggestedSeverity: 'Medium',
      hazardIndicators: ['Sharp exposed edge at head height', 'No weather protection for commuters'],
      alternatives: [{ category: 'Damaged road', confidence: 11 }],
      rejected: false,
      rejectionReason: null,
      model: 'pixtral-12b-2409',
      mode: 'mock',
      analyzedAt: ago(now, 3.15),
    },
    dedup: {
      outcome: 'master',
      masterTicketId: null,
      radiusMeters: 75,
      candidates: [],
      impactCount: 3,
      urgencyEscalations: 0,
      rationale: '2 reports merged inside the 75 m radius.',
      decidedAt: ago(now, 3.1),
    },
    triage: {
      department: 'PWD/Roads',
      severity: 'Medium',
      slaHours: SLA_HOURS.Medium,
      routingConfidence: 81,
      rationale: 'Bus shelter maintenance sits with PWD/Roads street furniture.',
      severitySignals: ['Sharp exposed edge', 'Low reporter volume'],
      appliedOverrideId: null,
      zoneKey: 'Koramangala:BBMP-South',
      model: 'mistral-large-latest',
      mode: 'mock',
      decidedAt: ago(now, 3.1),
    },
    sla: buildSla(now, 'Medium', ago(now, 3.1)),
    proof: null,
    citizenConfirmation: null,
    bounty: null,
    auditLog: [],
    tags: ['street-furniture'],
    createdAt: ago(now, 3.2),
    updatedAt: ago(now, 3.1),
    resolvedAt: null,
  };

  const tickets: CivicTicket[] = [
    hazard,
    pothole,
    drain,
    tree,
    garbage,
    traffic,
    road,
    infra,
    leak,
    light,
    potholeDuplicateA,
    potholeDuplicateB,
  ];

  /* ----------------------------------------------------------------------- */
  /* Civic Bounty Network — attach a bounty to every master ticket           */
  /* ----------------------------------------------------------------------- */

  function openBounty(t: CivicTicket): BountyInfo {
    return {
      baseAmount: computeBaseBounty(t.category, t.severity),
      communityBonus: 0,
      goldBonus: 0,
      csrSponsor: CSR_FUND.sponsorName,
      status: 'open',
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
      paidAt: null,
      transactionId: null,
      pledges: [],
    };
  }

  function pledge(id: string, ticketId: string, citizenPhone: string, amountInr: number, hoursAgo: number): BountyPledge {
    return {
      id,
      ticketId,
      citizenId: `citizen-${citizenPhone.slice(-4)}`,
      citizenDisplayName: pseudonymFor(citizenPhone),
      amountInr,
      source: 'citizen-boost',
      pledgedAt: ago(now, hoursAgo),
    };
  }

  for (const t of tickets) {
    t.bounty = t.isMaster ? openBounty(t) : null;
  }

  // The flagship dedup demo already has two neighbours chipping in — a live target for "Boost Bounty".
  pothole.bounty = {
    ...pothole.bounty!,
    communityBonus: 100,
    pledges: [pledge(`${potholeId}-pledge-1`, potholeId, '9845120337', 50, 40), pledge(`${potholeId}-pledge-2`, potholeId, '9845127178', 50, 22)],
  };

  // Silk Board obstruction: a CoV already accepted the mission — a live target for "Submit Fix Proof".
  traffic.bounty = {
    ...traffic.bounty!,
    status: 'in_progress',
    claimedBy: 'volunteer-suresh-btm',
    claimedByName: 'Suresh M.',
    claimedAt: ago(now, 5),
  };

  // HSR drain: proof is in, awaiting the citizen's confirmation — the payout releases the moment they tap "Looks good".
  drain.bounty = {
    ...drain.bounty!,
    status: 'pending_payout',
    communityBonus: 50,
    claimedBy: 'volunteer-ramesh-hsr',
    claimedByName: 'Ramesh K.',
    claimedAt: ago(now, 30),
    pledges: [pledge(`${drainId}-pledge-1`, drainId, '9845667201', 50, 26)],
  };

  // Indiranagar leak & Whitefield streetlight are already closed loops — paid receipts, for the Hall of Fame history.
  leak.bounty = {
    ...leak.bounty!,
    status: 'paid',
    communityBonus: 100,
    goldBonus: 100,
    claimedBy: 'volunteer-deepa-indiranagar',
    claimedByName: 'Deepa N.',
    claimedAt: ago(now, 82),
    paidAt: ago(now, 76),
    transactionId: '#CSR-71940-BLR',
    pledges: [pledge(`${leakId}-pledge-1`, leakId, '9845098201', 50, 80), pledge(`${leakId}-pledge-2`, leakId, '9845098202', 50, 79)],
  };
  light.bounty = {
    ...light.bounty!,
    status: 'paid',
    claimedBy: 'volunteer-farhan-whitefield',
    claimedByName: 'Farhan A.',
    claimedAt: ago(now, 124),
    paidAt: ago(now, 118),
    transactionId: '#CSR-58213-BLR',
  };

  /* ----------------------------------------------------------------------- */
  /* Self-healing routing memory                                             */
  /* ----------------------------------------------------------------------- */

  const routingOverrides: RoutingOverride[] = [
    {
      id: 'override-hsr-drain',
      category: 'Overflowing drain',
      zoneKey: 'HSR Layout:BBMP-Bommanahalli',
      centroid: { lat: 12.9124, lng: 77.6449, ward: 'HSR Layout', zone: 'BBMP-Bommanahalli' },
      radiusMeters: 900,
      fromDepartment: 'Sanitation',
      toDepartment: 'Water/Jal Board',
      occurrences: 4,
      weight: 0.81,
      reason:
        'HSR Sector 2 drains carry sewage ingress, which is a BWSSB subject. Ward marshals have re-routed this four times.',
      correctedBy: 'SWM Ward Marshal, HSR Layout',
      createdAt: ago(now, 69.4),
      lastAppliedAt: ago(now, 12),
      autoCorrectedCount: 7,
    },
    {
      id: 'override-whitefield-streetlight',
      category: 'Broken streetlight',
      zoneKey: 'Whitefield:BBMP-Mahadevapura',
      centroid: { lat: 12.9701, lng: 77.7492, ward: 'Whitefield', zone: 'BBMP-Mahadevapura' },
      radiusMeters: 1200,
      fromDepartment: 'PWD/Roads',
      toDepartment: 'Electricity/BESCOM',
      occurrences: 6,
      weight: 0.91,
      reason:
        'ITPL Main Road lighting is on the BESCOM feeder, not the BBMP pole contract. Six corrections agree.',
      correctedBy: 'PWD JE, Mahadevapura',
      createdAt: ago(now, 402),
      lastAppliedAt: ago(now, 26),
      autoCorrectedCount: 19,
    },
    {
      id: 'override-koramangala-drain',
      category: 'Water leakage',
      zoneKey: 'Koramangala:BBMP-South',
      centroid: { lat: 12.9349, lng: 77.6251, ward: 'Koramangala', zone: 'BBMP-South' },
      radiusMeters: 700,
      fromDepartment: 'PWD/Roads',
      toDepartment: 'Water/Jal Board',
      occurrences: 2,
      weight: 0.58,
      reason:
        'Road-surface water in Koramangala 4th Block traces back to the BWSSB main, not to drainage grade.',
      correctedBy: 'PWD AE, Koramangala',
      createdAt: ago(now, 168),
      lastAppliedAt: ago(now, 44),
      autoCorrectedCount: 3,
    },
    {
      id: 'override-silkboard-traffic',
      category: 'Traffic obstruction',
      zoneKey: 'BTM Layout:BBMP-Bommanahalli',
      centroid: { lat: 12.9175, lng: 77.6232, ward: 'BTM Layout', zone: 'BBMP-Bommanahalli' },
      radiusMeters: 800,
      fromDepartment: 'Traffic',
      toDepartment: 'PWD/Roads',
      occurrences: 3,
      weight: 0.72,
      reason:
        'Abandoned metro-contractor barricades at Silk Board need PWD removal; Traffic can only cordon them.',
      correctedBy: 'Traffic Inspector, Silk Board',
      createdAt: ago(now, 240),
      lastAppliedAt: ago(now, 58),
      autoCorrectedCount: 5,
    },
  ];

  /* ----------------------------------------------------------------------- */
  /* Agent decision stream (AgentTerminal seed)                              */
  /* ----------------------------------------------------------------------- */

  const agentLogs: AgentAuditLog[] = [
    log(
      'log-001',
      hazardId,
      'CivicEye',
      'vision.analyze',
      'Live conductor detected at pedestrian height — Emergency signature matched.',
      'error',
      {
        category: 'Broken streetlight',
        confidence: 97,
        hazards: ['live conductor', 'arcing', 'wet ground'],
      },
      97,
      1840,
      ago(now, 4.18),
    ),
    log(
      'log-002',
      hazardId,
      'TriageRouting',
      'route.assign',
      'Routed to Electricity/BESCOM with a 2 h Emergency SLA, bypassing the ward queue.',
      'warning',
      { department: 'Electricity/BESCOM', severity: 'Emergency', slaHours: 2 },
      99,
      620,
      ago(now, 4.15),
    ),
    log(
      'log-003',
      hazardId,
      'SlaSentinel',
      'sla.warn',
      '75 % of the 2 h Emergency window consumed with no field acknowledgement.',
      'warning',
      { percentElapsed: 75, remainingMinutes: 30 },
      null,
      45,
      ago(now, 2.65),
    ),
    log(
      'log-004',
      hazardId,
      'SlaSentinel',
      'sla.escalate',
      'SLA breached. Auto-escalated to the BESCOM Executive Engineer with a generated briefing.',
      'error',
      {
        escalationLevel: 2,
        escalatedTo: 'Executive Engineer — BESCOM Sub-Division',
        percentElapsed: 100,
      },
      null,
      910,
      ago(now, 2.1),
    ),
    log(
      'log-005',
      potholeId,
      'DedupCluster',
      'dedup.merge',
      '14 reports inside 75 m collapsed into CIVIC-2026-004821. 14 duplicate tickets avoided.',
      'success',
      { radiusMeters: 75, merged: 14, impactCount: 15, maxDistanceMeters: 71 },
      92,
      310,
      ago(now, 51.9),
    ),
    log(
      'log-006',
      potholeId,
      'TriageRouting',
      'severity.escalate',
      'Severity raised High → Very High on crowd corroboration from 15 citizens.',
      'warning',
      { from: 'High', to: 'Very High', impactCount: 15 },
      96,
      280,
      ago(now, 51.88),
    ),
    log(
      'log-007',
      drainId,
      'TriageRouting',
      'route.assign',
      'Initial routing sent the drain blockage to Sanitation.',
      'info',
      { department: 'Sanitation', confidence: 74 },
      74,
      540,
      ago(now, 73.9),
    ),
    log(
      'log-008',
      drainId,
      'TriageRouting',
      'selfheal.learn',
      'Authority flagged Wrong Department. Correction written to the routing graph: Sanitation → Water/Jal Board for Overflowing drain in HSR Layout.',
      'success',
      {
        overrideId: 'override-hsr-drain',
        from: 'Sanitation',
        to: 'Water/Jal Board',
        occurrences: 4,
        weight: 0.81,
      },
      null,
      150,
      ago(now, 69.4),
    ),
    log(
      'log-009',
      null,
      'TriageRouting',
      'selfheal.apply',
      'Learned override auto-corrected 7 later Overflowing drain reports in HSR Layout before a human saw them.',
      'success',
      { overrideId: 'override-hsr-drain', autoCorrectedCount: 7, weight: 0.81 },
      81,
      95,
      ago(now, 12),
    ),
    log(
      'log-010',
      drainId,
      'CivicProof',
      'proof.verify',
      'Before/after match confirmed on three fixed landmarks. Moved to Pending Citizen Confirmation.',
      'success',
      { verdict: 'verified', landmarkMatch: 95, repairEvidence: 91 },
      93,
      2410,
      ago(now, 5.9),
    ),
    log(
      'log-011',
      roadId,
      'CivicProof',
      'proof.reject',
      'Closure refused: the after photo shows a different location and carries no geotag.',
      'error',
      { verdict: 'rejected', landmarkMatch: 18, discrepancies: 4 },
      27,
      2280,
      ago(now, 29.9),
    ),
    log(
      'log-012',
      leakId,
      'CivicProof',
      'proof.verify',
      'Repair verified against metro pillar 312. Citizen approved with a 5-star rating.',
      'success',
      { verdict: 'verified', landmarkMatch: 97, citizenRating: 5 },
      96,
      2150,
      ago(now, 78.9),
    ),
    log(
      'log-013',
      garbageId,
      'SlaSentinel',
      'sla.escalate',
      '24 h Sanitation window breached with no pickup proof. Escalated to the Zonal Commissioner.',
      'error',
      { escalationLevel: 1, escalatedTo: 'Zonal Commissioner — Solid Waste Management' },
      null,
      760,
      ago(now, 2.9),
    ),
    log(
      'log-014',
      treeId,
      'CivicEye',
      'vision.analyze',
      'Uprooted trunk spanning both lanes. No conductor contact detected.',
      'info',
      { category: 'Fallen tree', confidence: 95, powerLineContact: false },
      95,
      1620,
      ago(now, 7.35),
    ),
    log(
      'log-015',
      infraId,
      'CivicEye',
      'vision.analyze',
      'Bus shelter roof sheeting detached. Classified as damaged public infrastructure.',
      'info',
      { category: 'Damaged public infrastructure', confidence: 86 },
      86,
      1490,
      ago(now, 3.15),
    ),
  ];

  // Attach each ticket's own slice of the decision stream.
  const byTicket = new Map<string, AgentAuditLog[]>();
  for (const entry of agentLogs) {
    if (!entry.ticketId) continue;
    const bucket = byTicket.get(entry.ticketId);
    if (bucket) bucket.push(entry);
    else byTicket.set(entry.ticketId, [entry]);
  }
  for (const ticket of tickets) {
    ticket.auditLog = byTicket.get(ticket.id) ?? [];
  }

  return { tickets, routingOverrides, agentLogs };
}

/**
 * SSR-stable seed, anchored to `SEED_EPOCH`. Safe to render on the server.
 * Call `buildSeedData(new Date())` after mount for live SLA countdowns.
 */
export const SEED_DATA: SeedData = buildSeedData(new Date(SEED_EPOCH));

export const SEED_TICKETS: CivicTicket[] = SEED_DATA.tickets;
export const SEED_ROUTING_OVERRIDES: RoutingOverride[] = SEED_DATA.routingOverrides;
export const SEED_AGENT_LOGS: AgentAuditLog[] = SEED_DATA.agentLogs;

/** Bangalore city centre — the default map view before geolocation resolves. */
export const BANGALORE_CENTER: GeoPoint = {
  lat: 12.9716,
  lng: 77.5946,
  address: 'Bengaluru, Karnataka',
  zone: 'BBMP',
};

/** Demo authority accounts, one per department, for the Phase 4 auth modal. */
export const DEMO_AUTHORITIES: Array<{
  officialId: string;
  name: string;
  department: Department;
  zone: string;
  designation: string;
}> = [
  {
    officialId: 'BBMP-SWM-1148',
    name: 'Ward Marshal, Ejipura',
    department: 'Sanitation',
    zone: 'BBMP-South',
    designation: 'Ward Marshal',
  },
  {
    officialId: 'BBMP-PWD-0114',
    name: 'Assistant Engineer, Koramangala',
    department: 'PWD/Roads',
    zone: 'BBMP-South',
    designation: 'Assistant Engineer',
  },
  {
    officialId: 'BESCOM-EE-0207',
    name: 'Executive Engineer, BTM Sub-Division',
    department: 'Electricity/BESCOM',
    zone: 'BBMP-South',
    designation: 'Executive Engineer',
  },
  {
    officialId: 'BWSSB-AEE-0322',
    name: 'Assistant Executive Engineer, HSR',
    department: 'Water/Jal Board',
    zone: 'BBMP-Bommanahalli',
    designation: 'Assistant Executive Engineer',
  },
  {
    officialId: 'BTP-INSP-0519',
    name: 'Traffic Inspector, Silk Board',
    department: 'Traffic',
    zone: 'BBMP-Bommanahalli',
    designation: 'Traffic Inspector',
  },
];

/** Categories seeded at least once, handy for filter chips. */
export const SEEDED_CATEGORIES: ComplaintCategory[] = Array.from(
  new Set(SEED_TICKETS.map((t) => t.category)),
);
