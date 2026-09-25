'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Brain,
  HardHat,
  ChevronDown,
  CircleCheck,
  FastForward,
  GitMerge,
  Map as MapIcon,
  Mic,
  RotateCcw,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Header, { type AppLanguage } from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import OnboardingModal from '@/components/OnboardingModal';
import CitizenIntakeForm from '@/components/CitizenIntakeForm';
import CitizenDashboard from '@/components/CitizenDashboard';
import CoVDashboard, { ProofResult } from '@/components/CoVDashboard';
import AIBrainDashboard, { computeBrainTelemetry } from '@/components/AIBrainDashboard';
import AgentTerminal from '@/components/AgentTerminal';
import BountyDashboard from '@/components/BountyDashboard';
import UpiReceiptModal from '@/components/UpiReceiptModal';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import LeafletMap from '@/components/LeafletMap';
import { useCivicloop } from '@/lib/useCivicloop';
import { CSR_FUND, DEMO_COVS, DEMO_VOLUNTEER, PLACEHOLDER_IMAGE, SEED_TOOL_DEPOTS } from '@/lib/seedData';
import { haversineMeters } from '@/lib/haversine';
import { cn } from '@/lib/cn';
import {
  CATEGORY_META,
  DEPARTMENT_META,
  SEVERITIES,
  SEVERITY_META,
  STATUS_META,
  maskPhone,
  pseudonymFor,
  type AdminProfile,
  type BountyInfo,
  type CivicProofVerification,
  type CivicTicket,
  type EvidencePhoto,
  type GeoPoint,
  type IntakeDraft,
  type PublicReporter,
  type SessionUser,
  type ToolDepot,
  type UserRole,
  type VolunteerProfile,
} from '@/types/civic';

/* ------------------------------------------------------------------------- */
/* Demo accounts & scripted scenarios                                        */
/* ------------------------------------------------------------------------- */

const DEMO_CITIZEN_PHONE = '9743028816';
const DEMO_CITIZEN: PublicReporter = {
  id: `citizen-${DEMO_CITIZEN_PHONE.slice(-4)}`,
  displayName: pseudonymFor(DEMO_CITIZEN_PHONE),
  maskedPhone: maskPhone(DEMO_CITIZEN_PHONE),
  verified: true,
  ward: 'HSR Layout',
};

const PWD_COV = DEMO_COVS.find((account) => account.department === 'PWD/Roads') ?? DEMO_COVS[0];
const DEMO_COV: VolunteerProfile = {
  ...DEMO_VOLUNTEER,
  id: `cov-${PWD_COV.covId.toLowerCase()}`,
  name: PWD_COV.name,
  maskedPhone: maskPhone('9845098450'),
  department: PWD_COV.department,
  zone: PWD_COV.zone,
  designation: 'Community Volunteer',
};

const DEMO_ADMIN: AdminProfile = {
  id: 'admin-demo',
  name: 'Admin Demo',
  email: 'admin@civicloop.demo',
  clearance: 'super-admin',
};

/** ~20 m from the seeded Koramangala pothole, so a manual pothole report demonstrates the merge. */
const DEMO_PIN: GeoPoint = { lat: 12.93535, lng: 77.62465, ward: 'Koramangala', zone: 'BBMP-South' };

const ONBOARDING_KEY = 'civicloop.onboarded';

function randomDemoReporter(): PublicReporter {
  const phone = `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
  return { id: `citizen-${phone.slice(-4)}`, displayName: pseudonymFor(phone), maskedPhone: maskPhone(phone), verified: true, ward: null };
}

function scenarioDraft(kind: 'pothole' | 'obstruction'): IntakeDraft {
  const base = { photos: [], language: 'en' as const, reporter: randomDemoReporter(), categoryOverride: null, voiceTranscript: null };
  if (kind === 'pothole') {
    return {
      ...base,
      description: 'Huge pothole near Sony World signal on 80 Feet Road, my bike almost skidded into it this morning.',
      location: { lat: 12.93532, lng: 77.62468, accuracyMeters: 9, address: 'Near Sony World Signal', ward: 'Koramangala', zone: 'BBMP-South' },
      inputModes: ['text', 'map-pin'],
    };
  }
  return {
    ...base,
    description: 'Contractor barricades and debris are blocking a lane near Silk Board junction, huge traffic jam every evening.',
    location: { lat: 12.9186, lng: 77.6241, accuracyMeters: 12, address: 'Hosur Road service lane, Silk Board', ward: 'BTM Layout', zone: 'BBMP-Bommanahalli' },
    inputModes: ['text', 'map-pin'],
  };
}

/* ------------------------------------------------------------------------- */
/* Onboarding flag (localStorage, hydration-safe)                            */
/* ------------------------------------------------------------------------- */

const noopSubscribe = () => () => {};

function readOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return true;
  }
}

function writeOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Storage blocked (private mode) — onboarding simply shows again next visit.
  }
}

/* ------------------------------------------------------------------------- */
/* Page sections                                                             */
/* ------------------------------------------------------------------------- */

const PITCH_ROWS: Array<{ icon: typeof GitMerge; topic: string; typical: string; civicloop: string }> = [
  {
    icon: GitMerge,
    topic: 'Duplicates',
    typical: 'Each submission is handled as its own grievance.',
    civicloop: '75 m geo-clustering folds 50 reports of one pothole into 1 master ticket with an impact counter that raises urgency.',
  },
  {
    icon: Route,
    topic: 'Routing',
    typical: 'The citizen picks a department; wrong picks bounce between offices.',
    civicloop: 'AI routes by category and location, and learns from every "wrong department" flag so the next report in that zone routes right first time.',
  },
  {
    icon: ShieldCheck,
    topic: 'Closure',
    typical: 'An officer can mark a complaint closed.',
    civicloop: 'No closure without proof: the after-photo is checked against the before-photo for matching landmarks, then the citizen signs off.',
  },
  {
    icon: Siren,
    topic: 'Deadlines',
    typical: 'Delays surface in periodic reviews.',
    civicloop: 'A live SLA sentinel warns at 75% and auto-escalates breaches up the chain with a generated briefing.',
  },
  {
    icon: Mic,
    topic: 'Intake',
    typical: 'Form-first, text-heavy.',
    civicloop: 'Snap a photo, speak in English, Kannada or Hindi, and drop a pin — AI does the classification.',
  },
];

function PitchBanner() {
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">Why Civicloop Wins over CPGRAMS &amp; Sahaaya 2.0</h2>
          <p className="text-xs text-slate-400">From a complaint inbox to a self-healing loop that closes on evidence.</p>
        </div>
        <ChevronDown className={cn('ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-800 px-5 pb-5 pt-2">
          <div className="grid gap-2">
            {PITCH_ROWS.map((row) => (
              <div key={row.topic} className="grid gap-2 rounded-xl bg-slate-800/60 p-3 md:grid-cols-[8rem_1fr_1.4fr] md:items-start">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <row.icon className="h-4 w-4 text-violet-300" /> {row.topic}
                </span>
                <span className="text-xs text-slate-400">
                  <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500 md:hidden">Typical:</span>
                  {row.typical}
                </span>
                <span className="flex items-start gap-1.5 text-xs text-emerald-200">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {row.civicloop}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            &quot;Typical&quot; describes common grievance-portal workflows; check current CPGRAMS and Sahaaya releases for specifics.
          </p>
        </div>
      )}
    </section>
  );
}

function DemoBar({
  busy,
  clockOffsetHours,
  onScenario,
  onFastForward,
  onReset,
}: {
  busy: boolean;
  clockOffsetHours: number;
  onScenario: (kind: 'pothole' | 'obstruction') => void;
  onFastForward: () => void;
  onReset: () => void;
}) {
  const button =
    'flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50';
  return (
    <div className="border-b border-violet-200 bg-violet-50">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2">
        <span className="shrink-0 text-xs font-bold text-violet-700">🚀 Quick Demo</span>
        <button type="button" disabled={busy} onClick={() => onScenario('pothole')} className={button}>
          <GitMerge className="h-3.5 w-3.5" /> Duplicate pothole report
        </button>
        <button type="button" disabled={busy} onClick={() => onScenario('obstruction')} className={button}>
          <Route className="h-3.5 w-3.5" /> Silk Board obstruction (self-healing)
        </button>
        <button type="button" onClick={onFastForward} className={button}>
          <FastForward className="h-3.5 w-3.5" /> Fast-forward SLA +6h
        </button>
        <button type="button" onClick={onReset} className={button}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        {clockOffsetHours > 0 && (
          <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">Clock +{clockOffsetHours}h</span>
        )}
      </div>
    </div>
  );
}

function MapCard({
  tickets,
  selectedTicketId,
  onSelectTicket,
  userLocation,
  onLocateMe,
  title = 'Live civic map',
  heightClass = 'h-[440px]',
  depots,
}: {
  tickets: CivicTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (id: string) => void;
  userLocation: GeoPoint | null;
  onLocateMe?: (point: GeoPoint) => void;
  title?: string;
  heightClass?: string;
  depots?: ToolDepot[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <MapIcon className="h-4 w-4" /> {title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
          {SEVERITIES.map((severity) => (
            <span key={severity} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEVERITY_META[severity].pin }} />
              {severity}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-500" /> 75 m cluster
          </span>
        </div>
      </div>
      <LeafletMap
        tickets={tickets}
        selectedTicketId={selectedTicketId}
        onSelectTicket={onSelectTicket}
        userLocation={userLocation}
        onLocateMe={onLocateMe}
        containerClassName={heightClass}
        depots={depots}
      />
    </section>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="text-sm text-slate-700">{children}</div>
    </section>
  );
}

function TicketDrawer({ ticket, logs, onClose }: { ticket: CivicTicket; logs: CivicTicket['auditLog']; onClose: () => void }) {
  const before = ticket.beforePhotos[0];
  const after = ticket.afterPhotos[ticket.afterPhotos.length - 1];
  const breached = ticket.sla.health === 'breached' && !ticket.sla.metAt;

  return (
    <div className="fixed inset-0 z-[1900] flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <span className="text-xs font-semibold text-slate-500">{ticket.referenceCode}</span>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {before && after ? (
            <BeforeAfterSlider beforeUrl={before.url} afterUrl={after.url} />
          ) : before ? (
            // eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL
            <img
              src={before.url}
              alt={ticket.title}
              className="aspect-video w-full rounded-xl object-cover"
              onError={(event) => {
                event.currentTarget.src = PLACEHOLDER_IMAGE;
              }}
            />
          ) : null}

          <div>
            <h3 className="text-lg font-bold leading-snug text-slate-900">
              {CATEGORY_META[ticket.category].icon} {ticket.title}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', SEVERITY_META[ticket.severity].badgeClass)}>
                {SEVERITY_META[ticket.severity].label}
              </span>
              <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
                {ticket.status}
              </span>
              {breached && (
                <span className="rounded border border-red-400 bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  SLA Breached · Auto-Escalated
                </span>
              )}
              {ticket.triage?.appliedOverrideId && (
                <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  🧠 Self-healed routing
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" /> Reported by {ticket.impactCount} citizen{ticket.impactCount === 1 ? '' : 's'} · first by{' '}
              {ticket.reporter.displayName}
            </p>
          </div>

          <DetailSection title="Report">
            <p>{ticket.description}</p>
            {ticket.voiceTranscript && <p className="mt-1 italic text-slate-500">🎙️ &quot;{ticket.voiceTranscript}&quot;</p>}
            <p className="mt-1 text-xs text-slate-500">📍 {ticket.location.address ?? `${ticket.location.lat.toFixed(5)}, ${ticket.location.lng.toFixed(5)}`}</p>
          </DetailSection>

          {ticket.civicEye && (
            <DetailSection title="👁️ CivicEye">
              <p>
                <strong>{ticket.civicEye.category}</strong> · {ticket.civicEye.confidence}% evidence confidence ({ticket.civicEye.mode})
              </p>
              <p className="mt-1 text-xs text-slate-500">{ticket.civicEye.observation}</p>
              {ticket.civicEye.hazardIndicators.length > 0 && (
                <p className="mt-1 text-xs text-slate-600">Hazards: {ticket.civicEye.hazardIndicators.join(' · ')}</p>
              )}
            </DetailSection>
          )}

          {ticket.dedup && (
            <DetailSection title="🧭 Deduplication">
              <p className="text-xs">{ticket.dedup.rationale}</p>
            </DetailSection>
          )}

          <DetailSection title="🧠 Routing">
            <p>
              {DEPARTMENT_META[ticket.assignedDepartment].icon} <strong>{ticket.assignedDepartment}</strong>
              {ticket.triage && ` · ${ticket.triage.routingConfidence}% confidence`}
            </p>
            {ticket.triage && <p className="mt-1 text-xs text-slate-500">{ticket.triage.rationale}</p>}
            <ol className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-3">
              {ticket.routingHistory.map((event) => (
                <li key={event.id} className="text-xs">
                  <span className="font-semibold text-slate-800">
                    {event.fromDepartment && event.fromDepartment !== event.toDepartment ? `${event.fromDepartment} → ` : ''}
                    {event.toDepartment}
                  </span>{' '}
                  <span className="text-slate-400">({event.trigger})</span>
                  <div className="text-slate-500">{event.reason}</div>
                </li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection title="⏱️ SLA">
            <p className="text-xs">
              {ticket.sla.slaHours} h {ticket.sla.severity} window · {Math.min(ticket.sla.percentElapsed, 999)}% elapsed · {ticket.sla.health.replace('_', ' ')}
            </p>
            {ticket.sla.escalationBriefing && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <div className="font-semibold">Escalated to {ticket.sla.escalatedTo}</div>
                <p className="mt-0.5">{ticket.sla.escalationBriefing}</p>
              </div>
            )}
          </DetailSection>

          {ticket.proof && (
            <DetailSection title="✅ CivicProof">
              <ProofResult ticket={ticket} verification={ticket.proof} />
            </DetailSection>
          )}

          {ticket.citizenConfirmation && (
            <DetailSection title="Citizen sign-off">
              <p className="text-xs">
                {ticket.citizenConfirmation.decision === 'approved' ? '👍 Approved' : '👎 Rejected'}
                {ticket.citizenConfirmation.rating ? ` · ${'★'.repeat(ticket.citizenConfirmation.rating)}` : ''}
              </p>
              {ticket.citizenConfirmation.comment && <p className="mt-1 text-xs italic text-slate-500">&quot;{ticket.citizenConfirmation.comment}&quot;</p>}
            </DetailSection>
          )}

          <AgentTerminal logs={logs} title={`Agent decisions · ${ticket.referenceCode}`} heightClass="h-56" />
        </div>
      </aside>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6_000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="fixed inset-x-0 bottom-4 z-[2100] flex justify-center px-4">
      <div className="flex max-w-lg items-start gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <span>{message}</span>
        <button type="button" onClick={onClose} className="ml-2 shrink-0 text-slate-400 hover:text-white" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The integration page                                                      */
/* ------------------------------------------------------------------------- */

type CitizenTab = 'bounties' | 'report' | 'reports' | 'map';
type CoVTab = 'bounties' | 'operations';

export default function Home() {
  const civic = useCivicloop();
  const { tickets, logs, overrides, volunteers, liveAi, nowMs, clockOffsetHours } = civic;

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRole, setAuthRole] = useState<UserRole>('citizen');
  const [demoMode, setDemoMode] = useState(true);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [citizenTab, setCitizenTab] = useState<CitizenTab>('bounties');
  const [covTab, setCovTab] = useState<CoVTab>('bounties');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [paidBounty, setPaidBounty] = useState<{ bounty: BountyInfo; ticketTitle: string } | null>(null);

  const onboarded = useSyncExternalStore(noopSubscribe, readOnboarded, () => true);
  const onboardingOpen = !onboarded && !onboardingDismissed;

  const masters = useMemo(() => tickets.filter((ticket) => ticket.isMaster), [tickets]);
  const telemetry = useMemo(() => computeBrainTelemetry(tickets, overrides), [tickets, overrides]);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const selectedLogs = useMemo(
    () => (selectedTicketId ? logs.filter((entry) => entry.ticketId === selectedTicketId) : []),
    [logs, selectedTicketId],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const citizen = sessionUser?.role === 'citizen' ? sessionUser.profile : null;
  const signedInVolunteer = sessionUser?.role === 'volunteer' ? sessionUser.profile : null;
  const volunteer = signedInVolunteer
    ? volunteers.find((entry) => entry.id === signedInVolunteer.id) ?? signedInVolunteer
    : null;
  const activeSessionUser =
    sessionUser?.role === 'volunteer' && volunteer ? { ...sessionUser, profile: volunteer } : sessionUser;
  const volunteerRoster = useMemo(
    () => (volunteer && !volunteers.some((entry) => entry.id === volunteer.id) ? [...volunteers, volunteer] : volunteers),
    [volunteers, volunteer],
  );

  const myTickets = useMemo(
    () =>
      citizen
        ? masters.filter(
            (ticket) => ticket.reporter.id === citizen.id || ticket.supporters.some((supporter) => supporter.reporter.id === citizen.id),
          )
        : [],
    [masters, citizen],
  );

  const nearbyTickets = useMemo(() => {
    if (!citizen) return [];
    const anchor = userLocation ?? myTickets[0]?.location ?? null;
    const candidates = masters.filter(
      (ticket) => !myTickets.includes(ticket) && !['Resolved', 'Rejected', 'Pending Citizen Confirmation'].includes(ticket.status),
    );
    if (!anchor) return candidates.slice(0, 4);
    return candidates
      .map((ticket) => ({ ticket, distance: haversineMeters(anchor, ticket.location) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
      .map((entry) => entry.ticket);
  }, [masters, myTickets, citizen, userLocation]);

  const openAuth = (role: UserRole = 'citizen') => {
    setAuthRole(role);
    setAuthOpen(true);
  };

  const signIn = (user: SessionUser, tab: CitizenTab = 'bounties') => {
    setSessionUser(user);
    setAuthOpen(false);
    setCitizenTab(tab);
    setCovTab(user.role === 'volunteer' ? 'operations' : 'bounties');
    setSelectedTicketId(null);
  };

  const quickSwitch = (role: UserRole) => {
    if (role === 'citizen') signIn({ role: 'citizen', profile: DEMO_CITIZEN }, 'bounties');
    else if (role === 'volunteer') signIn({ role: 'volunteer', profile: DEMO_COV });
    else signIn({ role: 'admin', profile: DEMO_ADMIN });
  };

  const acceptMission = (ticketId: string) => {
    if (!volunteer) return;
    civic.claimBounty(ticketId, volunteer);
    setToast(`Mission accepted — head to the location and tap "Submit Fix Proof" once it's done.`);
  };

  const boostBounty = (ticketId: string, amountInr: number) => {
    if (!citizen) return;
    civic.boostBounty(ticketId, citizen, amountInr);
    setToast(`Boosted by ₹${amountInr} — thanks for pitching in!`);
  };

  const submitMissionProof = (ticketId: string, afterPhoto: EvidencePhoto): Promise<CivicProofVerification> => {
    if (!volunteer) return Promise.reject(new Error('Not signed in as a Community Volunteer.'));
    return civic.submitProof(ticketId, afterPhoto, volunteer);
  };

  const handleIntake = async (draft: IntakeDraft) => {
    const result = await civic.submitIntake(draft);
    setToast(result.message);
    return result;
  };

  const runScenario = async (kind: 'pothole' | 'obstruction') => {
    setScenarioBusy(true);
    const result = await civic.submitIntake(scenarioDraft(kind));
    setScenarioBusy(false);
    setToast(result.message);
    if (result.ticketId) setSelectedTicketId(result.ticketId);
  };

  const fastForward = () => {
    civic.fastForward(6);
    setToast('Clock moved forward 6 hours — the SLA Sentinel re-checked every open ticket.');
  };

  const resetDemo = async () => {
    await civic.resetDemo();
    setSelectedTicketId(null);
    setToast('Demo data and the self-healing routing graph were reset to the seed state.');
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50 text-slate-900">
      <Header
        sessionUser={activeSessionUser}
        demoMode={demoMode}
        onToggleDemoMode={() => setDemoMode((value) => !value)}
        language={language}
        onLanguageChange={setLanguage}
        onOpenAuth={() => openAuth('citizen')}
        onLogout={() => {
          setSessionUser(null);
          setSelectedTicketId(null);
        }}
        onQuickSwitchRole={quickSwitch}
      />

      {demoMode && (
        <DemoBar
          busy={scenarioBusy}
          clockOffsetHours={clockOffsetHours}
          onScenario={runScenario}
          onFastForward={fastForward}
          onReset={resetDemo}
        />
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        {!sessionUser && (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  <Brain className="h-3.5 w-3.5" /> CivicSense · 5 autonomous agents
                </span>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
                  Report it once. Watch the city fix it — and prove it.
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                  Civicloop turns photos, voice notes and map pins into verified, deduplicated, correctly-routed civic tickets.
                  Duplicate reports merge, routing heals itself, missed deadlines escalate on their own, and nothing closes
                  without before/after proof.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAuth('citizen')}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Report an issue <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth('volunteer')}
                    className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <HardHat className="h-4 w-4" /> I&apos;m a CoV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Citizen reports', value: telemetry.totalReports, sub: `${telemetry.masterIssues} master issues` },
                  { label: 'Duplicates merged', value: `${telemetry.duplicateReductionPercent}%`, sub: `${telemetry.duplicatesMerged} tickets avoided` },
                  { label: 'Auto-escalations', value: telemetry.autoEscalations, sub: 'breaches briefed upward' },
                  { label: 'Proof-verified fixes', value: telemetry.proofVerified, sub: `${telemetry.proofRejected} fake proofs rejected` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">{stat.label}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-[11px] text-slate-500">{stat.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            <PitchBanner />

            <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
              <BountyDashboard
                csrFund={CSR_FUND}
                volunteers={volunteers}
                tickets={tickets}
                sessionUser={null}
                depots={SEED_TOOL_DEPOTS}
                onSelectTicket={setSelectedTicketId}
                onAcceptMission={() => openAuth('volunteer')}
                onBoostBounty={() => openAuth('citizen')}
                onSubmitProof={submitMissionProof}
                onSignIn={() => openAuth('volunteer')}
              />
              <MapCard
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                userLocation={userLocation}
                onLocateMe={setUserLocation}
                depots={SEED_TOOL_DEPOTS}
                heightClass="h-[600px]"
              />
            </div>
          </>
        )}

        {citizen && (
          <>
            <div className="flex rounded-xl bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-200">
              {(
                [
                  ['bounties', '🔥 Bounty Network'],
                  ['report', 'Report an issue'],
                  ['reports', `My reports (${myTickets.length})`],
                  ['map', 'City map'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCitizenTab(id)}
                  className={cn('flex-1 rounded-lg px-3 py-2', citizenTab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}
                >
                  {label}
                </button>
              ))}
            </div>

            {citizenTab === 'bounties' && (
              <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
                <BountyDashboard
                  csrFund={CSR_FUND}
                  volunteers={volunteerRoster}
                  tickets={tickets}
                  sessionUser={activeSessionUser}
                  depots={SEED_TOOL_DEPOTS}
                  onSelectTicket={setSelectedTicketId}
                  onAcceptMission={acceptMission}
                  onBoostBounty={boostBounty}
                  onSubmitProof={submitMissionProof}
                  onSignIn={() => openAuth('citizen')}
                />
                <MapCard
                  tickets={tickets}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  userLocation={userLocation}
                onLocateMe={setUserLocation}
                  depots={SEED_TOOL_DEPOTS}
                  heightClass="h-[600px]"
                />
              </div>
            )}

            {citizenTab === 'report' && (
              <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
                <CitizenIntakeForm
                  reporter={citizen}
                  language={language}
                  initialLocation={userLocation ?? (demoMode ? DEMO_PIN : null)}
                  onSubmit={handleIntake}
                  onCancel={() => setCitizenTab('reports')}
                />
              </section>
            )}

            {citizenTab === 'reports' && (
              <CitizenDashboard
                reporter={citizen}
                myTickets={myTickets}
                nearbyTickets={nearbyTickets}
                onSupportTicket={(ticketId, note) => {
                  civic.supportTicket(ticketId, citizen, note, userLocation);
                  setToast('You were added as a co-reporter — the impact counter went up.');
                }}
                onConfirmResolution={(ticketId, confirmation) => {
                  const ticket = tickets.find((entry) => entry.id === ticketId);
                  const payout = civic.confirmResolution(ticketId, confirmation, citizen.displayName);
                  if (payout && ticket) setPaidBounty({ bounty: payout, ticketTitle: ticket.title });
                  setToast(confirmation.decision === 'approved' ? 'Thanks — the ticket is now closed.' : 'Ticket reopened and sent back to the CoV.');
                }}
                onSelectTicket={setSelectedTicketId}
                onNewReport={() => setCitizenTab('report')}
              />
            )}

            {citizenTab === 'map' && (
              <MapCard
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                userLocation={userLocation}
                onLocateMe={setUserLocation}
                depots={SEED_TOOL_DEPOTS}
                heightClass="h-[560px]"
              />
            )}
          </>
        )}

        {volunteer && (
          <div className="space-y-5">
            <div className="flex rounded-xl bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-200">
              {(
                [
                  ['bounties', 'Bounty missions'],
                  ['operations', 'Department operations'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCovTab(id)}
                  className={cn('flex-1 rounded-lg px-3 py-2', covTab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}
                >
                  {label}
                </button>
              ))}
            </div>

            {covTab === 'bounties' && (
              <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
                <BountyDashboard
                  csrFund={CSR_FUND}
                  volunteers={volunteerRoster}
                  tickets={tickets}
                  sessionUser={activeSessionUser}
                  depots={SEED_TOOL_DEPOTS}
                  onSelectTicket={setSelectedTicketId}
                  onAcceptMission={acceptMission}
                  onBoostBounty={boostBounty}
                  onSubmitProof={submitMissionProof}
                  onSignIn={() => openAuth('volunteer')}
                />
                <MapCard
                  tickets={tickets}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  userLocation={userLocation}
                  onLocateMe={setUserLocation}
                  depots={SEED_TOOL_DEPOTS}
                  title="Bounty missions near you"
                  heightClass="h-[600px]"
                />
              </div>
            )}

            {covTab === 'operations' && (
              <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <CoVDashboard
                  cov={volunteer}
                  tickets={tickets}
                  nowMs={nowMs}
                  onStartWork={(ticketId) => civic.startWork(ticketId, volunteer.id)}
                  onReroute={async (ticketId, toDepartment, reason) => {
                    await civic.rerouteTicket(ticketId, toDepartment, reason, volunteer);
                    setToast(`Re-routed to ${toDepartment}. The self-healing graph learned the correction for this zone.`);
                  }}
                  onSubmitProof={(ticketId, afterPhoto) => civic.submitProof(ticketId, afterPhoto, volunteer)}
                  onSelectTicket={setSelectedTicketId}
                />
                <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                  <MapCard
                    tickets={tickets.filter((ticket) => ticket.assignedDepartment === volunteer.department)}
                    selectedTicketId={selectedTicketId}
                    onSelectTicket={setSelectedTicketId}
                    userLocation={userLocation}
                    onLocateMe={setUserLocation}
                    title={`${volunteer.department} issues`}
                    heightClass="h-[360px]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {sessionUser?.role === 'admin' && (
          <>
            <AIBrainDashboard tickets={tickets} overrides={overrides} logs={logs} liveAi={liveAi} />
            <MapCard
              tickets={tickets}
              selectedTicketId={selectedTicketId}
              onSelectTicket={setSelectedTicketId}
              userLocation={userLocation}
              onLocateMe={setUserLocation}
            />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-[11px] text-slate-500">
        Civicloop · CivicSense orchestration · CivicEye vision · OpenStreetMap contributors
      </footer>

      <AuthModal
        open={authOpen}
        demoMode={demoMode}
        initialRole={authRole}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(user) => signIn(user)}
      />

      <OnboardingModal
        open={onboardingOpen}
        onComplete={({ location }) => {
          writeOnboarded();
          setOnboardingDismissed(true);
          if (location) setUserLocation(location);
        }}
      />

      {selectedTicket && <TicketDrawer ticket={selectedTicket} logs={selectedLogs} onClose={() => setSelectedTicketId(null)} />}
      {toast && <Toast message={toast} onClose={dismissToast} />}

      <UpiReceiptModal
        bounty={paidBounty?.bounty ?? null}
        ticketTitle={paidBounty?.ticketTitle ?? ''}
        volunteerUpiId={volunteers.find((entry) => entry.id === paidBounty?.bounty.claimedBy)?.upiId ?? null}
        onClose={() => setPaidBounty(null)}
      />
    </div>
  );
}
