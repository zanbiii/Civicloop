'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Camera,
  HardHat,
  ChevronDown,
  Check,
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
import Header from '@/components/Header';
import { useAppLanguage, useTranslate } from '@/components/AppLanguageProvider';
import AuthModal from '@/components/AuthModal';
import OnboardingModal from '@/components/OnboardingModal';
import CitizenIntakeForm from '@/components/CitizenIntakeForm';
import CitizenDashboard from '@/components/CitizenDashboard';
import CoVDashboard, { ProofResult } from '@/components/CoVDashboard';
import AIBrainDashboard, { computeBrainTelemetry } from '@/components/AIBrainDashboard';
import AgentTerminal from '@/components/AgentTerminal';
import BountyDashboard from '@/components/BountyDashboard';
import GlideTabs from '@/components/GlideTabs';
import UpiReceiptModal from '@/components/UpiReceiptModal';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import LeafletMap from '@/components/LeafletMap';
import { useCivicloop } from '@/lib/useCivicloop';
import { CSR_FUND, DEMO_COVS, DEMO_VOLUNTEER, PLACEHOLDER_IMAGE, SEED_TOOL_DEPOTS, TKR_COLLEGE_CENTER } from '@/lib/seedData';
import { haversineMeters } from '@/lib/haversine';
import { isDemoTicket } from '@/lib/demo';
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

const DEMO_PIN: GeoPoint = TKR_COLLEGE_CENTER;

const ONBOARDING_KEY = 'civicloop.onboarded';

function randomDemoReporter(): PublicReporter {
  const phone = `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
  return { id: `citizen-${phone.slice(-4)}`, displayName: pseudonymFor(phone), maskedPhone: maskPhone(phone), verified: true, ward: null };
}

function scenarioDraft(kind: 'pothole' | 'obstruction'): IntakeDraft {
  const base = { photos: [], language: 'en' as const, reporter: randomDemoReporter(), categoryOverride: null, voiceTranscript: null, isDemo: true };
  if (kind === 'pothole') {
    return {
      ...base,
      description: 'Huge pothole near Sony World signal on 80 Feet Road, my bike almost skidded into it this morning.',
      location: { lat: 17.2844, lng: 78.5651, accuracyMeters: 250, address: 'Near TKR College main gate, Meerpet (demo)', ward: 'Meerpet', zone: 'GHMC-South-East' },
      inputModes: ['text', 'map-pin'],
    };
  }
  return {
    ...base,
    description: 'Contractor barricades and debris are blocking a lane near Silk Board junction, huge traffic jam every evening.',
    location: { lat: 17.2826, lng: 78.5684, accuracyMeters: 350, address: 'Meerpet main road near TKR College (demo)', ward: 'Meerpet', zone: 'GHMC-South-East' },
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
    typical: 'A CoV can mark a complaint closed.',
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
  const t = useTranslate();
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[#102b27] text-white shadow-[0_18px_55px_-38px_rgb(15_23_42_/55%)]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">{t('Why Civicloop Wins over CPGRAMS & Sahaaya 2.0')}</h2>
          <p className="text-xs text-emerald-50/55">{t('From a complaint inbox to a self-healing loop that closes on evidence.')}</p>
        </div>
        <ChevronDown className={cn('ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-slate-800 px-5 pb-5 pt-2">
          <div className="grid gap-2.5">
            {PITCH_ROWS.map((row) => (
              <div key={row.topic} className="grid gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.045] p-3.5 md:grid-cols-[8rem_1fr_1.4fr] md:items-start">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <row.icon className="h-4 w-4 text-emerald-200" /> {t(row.topic)}
                </span>
                <span className="text-xs text-slate-400">
                  <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500 md:hidden">{t('Typical:')}</span>
                  {t(row.typical)}
                </span>
                <span className="flex items-start gap-1.5 text-xs leading-relaxed text-emerald-100">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  {t(row.civicloop)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            {t('"Typical" describes common grievance-portal workflows; check current CPGRAMS and Sahaaya releases for specifics.')}
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
  const t = useTranslate();
  const button =
    'flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-700/20 hover:bg-emerald-50 disabled:opacity-50';
  return (
    <div className="border-b border-emerald-900/10 bg-[#e8f4ef]">
      <div className="soft-scrollbar mx-auto flex max-w-[90rem] items-center gap-2 overflow-x-auto px-3 py-2 sm:px-5 lg:px-8">
        <span className="shrink-0 rounded-full bg-emerald-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{t('Demo lab')}</span>
        <button type="button" disabled={busy} onClick={() => onScenario('pothole')} className={button}>
          <GitMerge className="h-3.5 w-3.5" /> {t('Duplicate pothole report')}
        </button>
        <button type="button" disabled={busy} onClick={() => onScenario('obstruction')} className={button}>
          <Route className="h-3.5 w-3.5" /> {t('Silk Board obstruction (self-healing)')}
        </button>
        <button type="button" onClick={onFastForward} className={button}>
          <FastForward className="h-3.5 w-3.5" /> {t('Fast-forward SLA +6h')}
        </button>
        <button type="button" onClick={onReset} className={button}>
          <RotateCcw className="h-3.5 w-3.5" /> {t('Reset')}
        </button>
        {clockOffsetHours > 0 && (
          <span className="shrink-0 rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold text-white">Clock +{clockOffsetHours}h</span>
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
  showingDemoReports = false,
}: {
  tickets: CivicTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (id: string) => void;
  userLocation: GeoPoint | null;
  onLocateMe?: (point: GeoPoint) => void;
  title?: string;
  heightClass?: string;
  depots?: ToolDepot[];
  showingDemoReports?: boolean;
}) {
  const t = useTranslate();
  return (
    <section className="surface-card overflow-hidden p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <MapIcon className="h-4 w-4" /> {t(title)}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
          {SEVERITIES.map((severity) => {
            const [label, duration] = SEVERITY_META[severity].label.split(' · ');
            return (
              <span key={severity} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEVERITY_META[severity].pin }} />
                {t(label)} · {duration}
              </span>
            );
          })}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-500" /> {t('75 m cluster')}
          </span>
        </div>
      </div>
      <p className={cn('mb-2 px-1 text-[11px]', showingDemoReports ? 'text-amber-700' : 'text-slate-500')}>
        {showingDemoReports
          ? t('No real reports within 10 km. Showing clearly labeled examples.')
          : tickets.length > 0
            ? t('Showing saved reports within 10 km of this area.')
            : `${t('No nearby reports yet')} ${t('Use your device location for accurate nearby reports.')}`}
        {!userLocation && <span className="ml-1 font-medium">{t('Near TKR College · approximate area')}</span>}
      </p>
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
  const t = useTranslate();
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
                {t(SEVERITY_META[ticket.severity].label)}
              </span>
              <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
                {t(ticket.status)}
              </span>
              {breached && (
                <span className="rounded border border-red-400 bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {t('SLA Breached · Auto-Escalated')}
                </span>
              )}
              {ticket.triage?.appliedOverrideId && (
                <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  🧠 {t('Self-healed routing')}
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" /> {t('Reported by')} {ticket.impactCount} {t(ticket.impactCount === 1 ? 'citizen' : 'citizens')} · {t('first by')}{' '}
              {ticket.reporter.displayName}
            </p>
          </div>

          <DetailSection title={t('Report')}>
            <p>{ticket.description}</p>
            {ticket.voiceTranscript && <p className="mt-1 italic text-slate-500">🎙️ &quot;{ticket.voiceTranscript}&quot;</p>}
            <p className="mt-1 text-xs text-slate-500">📍 {ticket.location.address ?? `${ticket.location.lat.toFixed(5)}, ${ticket.location.lng.toFixed(5)}`}</p>
          </DetailSection>

          {ticket.civicEye && (
            <DetailSection title={t('👁️ CivicEye')}>
              <p>
                <strong>{t(ticket.civicEye.category)}</strong> · {ticket.civicEye.confidence}% {t('evidence confidence')} ({ticket.civicEye.mode})
              </p>
              <p className="mt-1 text-xs text-slate-500">{ticket.civicEye.observation}</p>
              {ticket.civicEye.hazardIndicators.length > 0 && (
                <p className="mt-1 text-xs text-slate-600">{t('Hazards:')} {ticket.civicEye.hazardIndicators.join(' · ')}</p>
              )}
            </DetailSection>
          )}

          {ticket.dedup && (
            <DetailSection title={t('🧭 Deduplication')}>
              <p className="text-xs">{ticket.dedup.rationale}</p>
            </DetailSection>
          )}

          <DetailSection title={t('🧠 Routing')}>
            <p>
              {DEPARTMENT_META[ticket.assignedDepartment].icon} <strong>{ticket.assignedDepartment}</strong>
              {ticket.triage && ` · ${ticket.triage.routingConfidence}% ${t('confidence')}`}
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

          <DetailSection title={t('⏱️ SLA')}>
            <p className="text-xs">
              {ticket.sla.slaHours} h {t(ticket.sla.severity)} {t('window')} · {Math.min(ticket.sla.percentElapsed, 999)}% {t('elapsed')} · {t(ticket.sla.health.replace('_', ' '))}
            </p>
            {ticket.sla.escalationBriefing && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <div className="font-semibold">{t('Escalated to')} {ticket.sla.escalatedTo}</div>
                <p className="mt-0.5">{ticket.sla.escalationBriefing}</p>
              </div>
            )}
          </DetailSection>

          {ticket.proof && (
            <DetailSection title={t('✅ CivicProof')}>
              <ProofResult ticket={ticket} verification={ticket.proof} />
            </DetailSection>
          )}

          {ticket.citizenConfirmation && (
            <DetailSection title={t('Citizen sign-off')}>
              <p className="text-xs">
                {ticket.citizenConfirmation.decision === 'approved' ? `👍 ${t('Approved')}` : `👎 ${t('Rejected')}`}
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
  const t = useTranslate();
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6_000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="fixed inset-x-0 bottom-4 z-[2100] flex justify-center px-4">
      <div className="flex max-w-lg items-start gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <span>{t(message)}</span>
        <button type="button" onClick={onClose} className="ml-2 shrink-0 text-slate-400 hover:text-white" aria-label={t('Dismiss')}>
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
  const { language, setLanguage } = useAppLanguage();
  const t = useTranslate();
  const civic = useCivicloop();
  const { tickets, logs, overrides, volunteers, liveAi, nowMs, clockOffsetHours } = civic;

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRole, setAuthRole] = useState<UserRole>('citizen');
  const [demoMode, setDemoMode] = useState(true);
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
  const anchorLocation = userLocation ?? TKR_COLLEGE_CENTER;
  const tkrSampleReports = useMemo(() => {
    const examples = [
      { category: 'Pothole', title: 'Pothole near TKR College main gate', address: 'Near TKR College main gate, Meerpet (sample)' },
      { category: 'Garbage accumulation', title: 'Uncollected waste near Meerpet market', address: 'Meerpet market area (sample)' },
      { category: 'Broken streetlight', title: 'Streetlight out near the TKR College road', address: 'TKR College Road, Meerpet (sample)' },
    ] as const;
    return examples.flatMap((example, index) => {
      const source = masters.find((ticket) => ticket.category === example.category);
      if (!source) return [];
      const angle = (index * 2 * Math.PI) / examples.length;
      const distanceKm = 0.35 + index * 0.35;
      return [{
        ...source,
        id: `demo-tkr-${index + 1}`,
        referenceCode: `DEMO-TKR-${String(index + 1).padStart(3, '0')}`,
        title: example.title,
        description: 'Illustrative demo example only. This is not a verified report of an issue at this location.',
        location: {
          ...TKR_COLLEGE_CENTER,
          lat: TKR_COLLEGE_CENTER.lat + (Math.cos(angle) * distanceKm) / 111.32,
          lng: TKR_COLLEGE_CENTER.lng + (Math.sin(angle) * distanceKm) / (111.32 * Math.cos((TKR_COLLEGE_CENTER.lat * Math.PI) / 180)),
          address: example.address,
        },
        supporters: [],
        impactCount: 1,
        assignedCoV: null,
        routingHistory: [],
        auditLog: [],
        tags: [...source.tags.filter((tag) => tag !== 'demo-sample'), 'demo-sample'],
      }];
    });
  }, [masters]);
  const localAreaTickets = useMemo(() => {
    const realReports = masters
      .filter((ticket) => !isDemoTicket(ticket) && haversineMeters(anchorLocation, ticket.location) <= 10_000)
      .sort((a, b) => haversineMeters(anchorLocation, a.location) - haversineMeters(anchorLocation, b.location));
    if (realReports.length > 0) return realReports;
    if (haversineMeters(anchorLocation, TKR_COLLEGE_CENTER) <= 10_000) return tkrSampleReports;
    return [];
  }, [masters, anchorLocation, tkrSampleReports]);
  const showingDemoReports = localAreaTickets.length > 0 && localAreaTickets.every(isDemoTicket);
  const telemetry = useMemo(() => computeBrainTelemetry(tickets, overrides), [tickets, overrides]);
  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    localAreaTickets.find((ticket) => ticket.id === selectedTicketId) ??
    null;
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
            (ticket) =>
              !isDemoTicket(ticket) &&
              (ticket.reporter.id === citizen.id || ticket.supporters.some((supporter) => supporter.reporter.id === citizen.id)),
          )
        : [],
    [masters, citizen],
  );

  const nearbyTickets = useMemo(() => {
    if (!citizen) return [];
    const candidates = localAreaTickets.filter(
      (ticket) => !myTickets.includes(ticket) && !['Resolved', 'Rejected', 'Pending Citizen Confirmation'].includes(ticket.status),
    );
    return candidates.slice(0, 4);
  }, [localAreaTickets, myTickets, citizen]);

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
    setToast(`${t('Boosted by')} ₹${amountInr} — ${t('thanks for pitching in!')}`);
  };

  const submitMissionProof = (ticketId: string, afterPhoto: EvidencePhoto): Promise<CivicProofVerification> => {
    if (!volunteer) return Promise.reject(new Error('Not signed in as a Community Volunteer.'));
    return civic.submitProof(ticketId, afterPhoto, volunteer);
  };

  const handleIntake = async (draft: IntakeDraft) => {
    if ((demoMode || !civic.persistenceEnabled) && !draft.isDemo) {
      return { success: false, message: t('Live report submission is unavailable in this demo. Your report has not been sent or saved.') };
    }
    const result = await civic.submitIntake(draft);
    if (result.success) setToast(result.message);
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
    setToast(
      civic.persistenceEnabled
        ? t('Saved reports were preserved. The demo reset cannot clear live data.')
        : t('Demo data and the self-healing routing graph were reset to the seed state.'),
    );
  };

  return (
    <div className="app-shell flex min-h-full flex-1 flex-col text-slate-900">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[3000] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg focus:not-sr-only"
      >
        Skip to content
      </a>
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

      <main id="main-content" className="mx-auto w-full max-w-[90rem] flex-1 space-y-7 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-8 lg:px-8">
        {!sessionUser && (
          <>
            <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#0c3029] px-5 py-7 text-white shadow-[0_24px_80px_-36px_rgb(6_78_59_/65%)] sm:rounded-[2rem] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-24 -top-36 -z-10 h-[28rem] w-[28rem] rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-48 left-[30%] -z-10 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
              <div className="grid gap-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
              <div className="space-y-5 sm:space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-100/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-100">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                  </span>
                  {t('CIVICSENSE · 5 AI AGENTS AT WORK')}
                </span>
                <h1 className="max-w-2xl text-[2.4rem] font-bold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl lg:text-[3.65rem]">
                  {t('Your neighborhood,')} <span className="text-emerald-300">{t('better by design.')}</span>
                </h1>
                <p className="max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                  {t('Report a local issue in seconds. Civicloop brings neighbors together, gets the right team on it, and keeps the fix accountable from first photo to final proof.')}
                </p>
                <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openAuth('citizen')}
                    className="group flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-200"
                  >
                    {t('Report an issue')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth('volunteer')}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
                  >
                    <HardHat className="h-4 w-4 text-emerald-200" /> {t('Join as a CoV')}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-[11px] font-medium text-emerald-50/65">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> {t('Your identity stays private')}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-emerald-200/40 sm:block" />
                  <span>{t('English · ಕನ್ನಡ · हिन्दी')}</span>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 rounded-[2rem] bg-emerald-300/5 blur-2xl" />
                <div className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">{t('City impact')}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{t('Small actions. Visible progress.')}</div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/15 bg-emerald-200/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {t('Live demo')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {[
                  { label: t('Neighbors heard'), value: telemetry.totalReports, sub: `${telemetry.masterIssues} ${t('issues tracked')}`, icon: Users },
                  { label: t('Less duplicate noise'), value: `${telemetry.duplicateReductionPercent}%`, sub: `${telemetry.duplicatesMerged} ${t('reports combined')}`, icon: GitMerge },
                  { label: t('On-time accountability'), value: telemetry.autoEscalations, sub: t('automatic deadline escalations'), icon: Siren },
                  { label: t('Fixes with proof'), value: telemetry.proofVerified, sub: `${telemetry.proofRejected} ${t('proofs reviewed')}`, icon: Check },
                ].map((stat) => (
                  <div key={stat.label} className="min-h-[116px] rounded-2xl border border-white/10 bg-[#f7fbf9] p-3.5 text-slate-900 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">{stat.label}</div>
                      <stat.icon className="h-4 w-4 shrink-0 text-emerald-700" />
                    </div>
                    <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">{stat.value}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">{stat.sub}</div>
                  </div>
                ))}
              </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200/10 bg-emerald-950/35 px-3 py-2.5 text-[11px] text-emerald-50/75">
                    <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                    {t('Every report is tracked. Every resolution needs evidence.')}
                  </div>
                </div>
              </div>
              </div>
            </section>

            <PitchBanner />

            <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
              <BountyDashboard
                csrFund={CSR_FUND}
                volunteers={volunteers}
                tickets={localAreaTickets}
                sessionUser={null}
                depots={SEED_TOOL_DEPOTS}
                onSelectTicket={setSelectedTicketId}
                onAcceptMission={() => openAuth('volunteer')}
                onBoostBounty={() => openAuth('citizen')}
                onSubmitProof={submitMissionProof}
                onSignIn={() => openAuth('volunteer')}
              />
              <MapCard
                tickets={localAreaTickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                userLocation={userLocation}
                onLocateMe={setUserLocation}
                depots={SEED_TOOL_DEPOTS}
                showingDemoReports={showingDemoReports}
                heightClass="h-[380px] sm:h-[480px] lg:h-[600px]"
              />
            </div>
          </>
        )}

        {citizen && (
          <>
            <GlideTabs
              ariaLabel="Citizen dashboard"
              value={citizenTab}
              onChange={setCitizenTab}
              className="surface-card"
              items={[
                { id: 'bounties', label: t('Bounty network'), icon: HardHat },
                { id: 'report', label: t('Report an issue'), icon: Camera },
                { id: 'reports', label: <>{t('My reports')} <span className="text-[10px] opacity-70">({myTickets.length})</span></>, icon: CircleCheck },
                { id: 'map', label: t('City map'), icon: MapIcon },
              ]}
            />

            {citizenTab === 'bounties' && (
              <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
                <BountyDashboard
                  csrFund={CSR_FUND}
                  volunteers={volunteerRoster}
                  tickets={localAreaTickets}
                  sessionUser={activeSessionUser}
                  depots={SEED_TOOL_DEPOTS}
                  onSelectTicket={setSelectedTicketId}
                  onAcceptMission={acceptMission}
                  onBoostBounty={boostBounty}
                  onSubmitProof={submitMissionProof}
                  onSignIn={() => openAuth('citizen')}
                />
                <MapCard
                  tickets={localAreaTickets}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  userLocation={userLocation}
                  onLocateMe={setUserLocation}
                  depots={SEED_TOOL_DEPOTS}
                  showingDemoReports={showingDemoReports}
                  heightClass="h-[380px] sm:h-[480px] lg:h-[600px]"
                />
              </div>
            )}

            {citizenTab === 'report' && (
              <section className="surface-card mx-auto max-w-3xl p-4 sm:p-7">
                <CitizenIntakeForm
                  reporter={citizen}
                  language={language}
                  initialLocation={userLocation ?? (demoMode ? DEMO_PIN : null)}
                  canSubmitReport={!demoMode && civic.persistenceEnabled}
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
                tickets={localAreaTickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                userLocation={userLocation}
                onLocateMe={setUserLocation}
                showingDemoReports={showingDemoReports}
                depots={SEED_TOOL_DEPOTS}
                heightClass="h-[380px] sm:h-[480px] lg:h-[560px]"
              />
            )}
          </>
        )}

        {volunteer && (
          <div className="space-y-5">
            <GlideTabs
              ariaLabel="CoV dashboard"
              value={covTab}
              onChange={setCovTab}
              className="surface-card"
              items={[
                { id: 'bounties', label: 'Bounty missions', icon: HardHat },
                { id: 'operations', label: 'Department operations', icon: Route },
              ]}
            />

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
                  tickets={tickets.filter((ticket) => !isDemoTicket(ticket))}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  userLocation={userLocation}
                  onLocateMe={setUserLocation}
                  depots={SEED_TOOL_DEPOTS}
                  title="Bounty missions near you"
                  heightClass="h-[380px] sm:h-[480px] lg:h-[600px]"
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
                    setToast(`${t('Re-routed to')} ${toDepartment}. ${t('The self-healing graph learned the correction for this zone.')}`);
                  }}
                  onSubmitProof={(ticketId, afterPhoto) => civic.submitProof(ticketId, afterPhoto, volunteer)}
                  onSelectTicket={setSelectedTicketId}
                />
                <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                  <MapCard
                    tickets={tickets.filter((ticket) => !isDemoTicket(ticket) && ticket.assignedDepartment === volunteer.department)}
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

      <footer className="mt-8 border-t border-slate-200/80 bg-white/65 px-4 py-5 text-center text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">Civicloop</span> · {t('CivicSense orchestration · CivicEye vision · OpenStreetMap contributors')}
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
