'use client';

import CountUp from '@/components/CountUp';
import KpiStrip from '@/components/KpiStrip';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Brain,
  Camera,
  HardHat,
  ChevronDown,
  Check,
  CircleCheck,
  FastForward,
  GitMerge,
  LoaderCircle,
  Map as MapIcon,
  Mic,
  Moon,
  RotateCcw,
  Route,
  ShieldCheck,
  Search,
  Siren,
  Sparkles,
  TriangleAlert,
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
import Sidebar, { type SidebarItem } from '@/components/Sidebar';
import CityScene from '@/components/scene/CityScene';
import UpiReceiptModal from '@/components/UpiReceiptModal';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import LeafletMap from '@/components/LeafletMap';
import CsrFundingSection from '@/components/CsrFundingSection';
import { useAppTheme } from '@/components/AppThemeProvider';
import CommandPalette, { type PaletteGroup } from '@/components/fx/CommandPalette';
import HudFrame from '@/components/fx/HudFrame';
import { LiveIndicator } from '@/components/fx/Indicators';
import ScrambleText from '@/components/fx/ScrambleText';
import SplitText from '@/components/fx/SplitText';
import { useCivicloop } from '@/lib/useCivicloop';
import { CSR_FUND, DEMO_COVS, DEMO_VOLUNTEER, PLACEHOLDER_IMAGE, SEED_TOOL_DEPOTS, TKR_COLLEGE_CENTER } from '@/lib/seedData';
import { haversineMeters } from '@/lib/haversine';
import { isDemoTicket } from '@/lib/demo';
import { cn } from '@/lib/cn';
import { useEscapeKey } from '@/lib/useEscapeKey';
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

const LOOP_STEPS: Array<{ name: string; blurb: string; icon: typeof Brain }> = [
  { name: 'CivicEye', blurb: 'Reads the photo and voice note, then tags the hazard and its severity.', icon: Camera },
  { name: 'Dedup', blurb: 'Folds every report within 75 m into one master ticket with an impact counter.', icon: GitMerge },
  { name: 'Triage', blurb: 'Routes to the right department and learns from every correction.', icon: Route },
  { name: 'SLA Sentinel', blurb: 'Warns at 75% of the deadline and escalates breaches with a briefing.', icon: Siren },
  { name: 'CivicProof', blurb: 'Checks the after-photo against the before-photo, then the citizen signs off.', icon: ShieldCheck },
];

function PitchBanner() {
  const t = useTranslate();
  const [open, setOpen] = useState(true);
  return (
    <section id="loop-compare" className="fx-border fx-pitch reveal relative overflow-hidden rounded-xl text-white">
      <span className="fx-sweep" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="pitch-banner-body"
        className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/4 sm:px-5"
      >
        <span className="side-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">{t('Why Civicloop Wins over CPGRAMS & Sahaaya 2.0')}</h2>
          <p className="text-xs text-white/55">{t('From a complaint inbox to a self-healing loop that closes on evidence.')}</p>
        </div>
        <ChevronDown className={cn('ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-[#ff8a5f]', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id="pitch-banner-body" className="animate-slide-down border-t border-white/10 px-5 pb-5 pt-2">
          <div className="fx-stagger grid gap-2.5">
            {PITCH_ROWS.map((row) => (
              <div key={row.topic} className="fx-spot grid gap-2.5 rounded-lg border border-white/8 bg-white/4 p-3.5 transition-[border-color,transform] duration-300 hover:translate-x-1 hover:border-(--signal)/60 md:grid-cols-[8rem_1fr_1.4fr] md:items-start">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <row.icon className="h-4 w-4 text-[#ff8a5f]" /> {t(row.topic)}
                </span>
                <span className="text-xs text-slate-400">
                  <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500 md:hidden">{t('Typical:')}</span>
                  {t(row.typical)}
                </span>
                <span className="flex items-start gap-1.5 text-xs leading-relaxed text-[#ffd9c9]">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff8a5f]" />
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
  // UI-only: remembers which scenario was clicked so its button can show the spinner while `busy`.
  const [lastScenario, setLastScenario] = useState<'pothole' | 'obstruction' | null>(null);
  const runScenario = (kind: 'pothole' | 'obstruction') => {
    setLastScenario(kind);
    onScenario(kind);
  };
  const button =
    'demo-bar-action flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border-[1.5px] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition duration-150 active:scale-[0.97] disabled:opacity-50';
  return (
    <div className="demo-bar">
      <div className="soft-scrollbar mx-auto flex max-w-360 items-center gap-2 overflow-x-auto px-3 py-2 sm:px-5 lg:px-8">
        <span className="shrink-0 chip-ink rounded-md px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">{t('Demo lab')}</span>
        <button type="button" disabled={busy} aria-busy={busy && lastScenario === 'pothole'} onClick={() => runScenario('pothole')} className={button}>
          {busy && lastScenario === 'pothole' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />}
          {t('Duplicate pothole report')}
        </button>
        <button type="button" disabled={busy} aria-busy={busy && lastScenario === 'obstruction'} onClick={() => runScenario('obstruction')} className={button}>
          {busy && lastScenario === 'obstruction' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Route className="h-3.5 w-3.5" aria-hidden="true" />}
          {t('Silk Board obstruction (self-healing)')}
        </button>
        <button type="button" onClick={onFastForward} className={button}>
          <FastForward className="h-3.5 w-3.5" /> {t('Fast-forward SLA +6h')}
        </button>
        <button type="button" onClick={onReset} className={button}>
          <RotateCcw className="h-3.5 w-3.5" /> {t('Reset')}
        </button>
        {clockOffsetHours > 0 && (
          <span role="status" className="shrink-0 animate-scale-in chip-ink rounded-md px-2 py-0.5 font-mono text-[10px] font-bold">Clock +{clockOffsetHours}h</span>
        )}
      </div>
    </div>
  );
}

function CommandDeck({ name, role, blurb }: { name: string; role: string; blurb: string }) {
  const t = useTranslate();
  return (
    <section className="surface-card holo relative isolate min-h-46 overflow-hidden sm:min-h-56">
      <span className="fx-sweep" aria-hidden="true" />
      <HudFrame readout="17.2844°N · 78.5651°E" scan className="hidden sm:block" />
      <CityScene variant="banner" className="absolute inset-y-0 right-0 -z-20 w-full opacity-45 sm:w-[66%] sm:opacity-100" />
      {/* Paper scrim keeps the greeting legible wherever the city runs under it. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--surface)_0%,var(--surface)_34%,color-mix(in_srgb,var(--surface)_70%,transparent)_52%,transparent_72%)] dark:bg-[linear-gradient(90deg,#070a1c_0%,rgb(7_10_28/85%)_38%,transparent_75%)]" />
      <div className="relative z-3 max-w-lg p-5 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="eyebrow"><ScrambleText text={t(role)} /></span>
          <LiveIndicator label={t('Online')} tone="cyan" />
        </div>
        <h2 className="mt-3 text-3xl font-extrabold leading-[0.95] text-ink sm:text-5xl">
          <SplitText text={t('Welcome back,')} />{' '}
          <span className="hero-mark"><SplitText text={name} startIndex={14} gradient /></span>
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-700">{t(blurb)}</p>
      </div>
    </section>
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
  stretchToColumn = false,
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
  stretchToColumn?: boolean;
  depots?: ToolDepot[];
  showingDemoReports?: boolean;
}) {
  const t = useTranslate();
  return (
    <section className={cn('surface-card overflow-hidden p-3 sm:p-4', stretchToColumn && 'lg:flex lg:h-full lg:flex-col')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapIcon className="h-4 w-4 text-signal" /> {t(title)}
          <LiveIndicator label={t('Live')} className="ml-1" />
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
        containerClassName={cn(heightClass, stretchToColumn && 'lg:min-h-[600px] lg:flex-1')}
        depots={depots}
      />
    </section>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="text-sm text-slate-700">{children}</div>
    </section>
  );
}

function TicketDrawer({ ticket, logs, onClose }: { ticket: CivicTicket; logs: CivicTicket['auditLog']; onClose: () => void }) {
  const t = useTranslate();
  const before = ticket.beforePhotos[0];
  const after = ticket.afterPhotos[ticket.afterPhotos.length - 1];
  const breached = ticket.sla.health === 'breached' && !ticket.sla.metAt;
  useEscapeKey(onClose);

  return (
    <div className="fx-scrim fixed inset-0 z-1900 flex animate-fade-in justify-end bg-slate-950/45" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${ticket.referenceCode} · ${ticket.title}`}
        className="fx-drawer soft-scrollbar h-full w-full max-w-lg animate-slide-in-right overflow-y-auto border-l-[1.5px] border-ink bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">{ticket.referenceCode}</span>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
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

const TOAST_MS = 6_000;
const WARNING_WORDS = /unavailable|cannot|not been|rejected|reopened|failed/i;

/** `aboveDock` lifts the toast clear of the phone bottom dock, which only exists when signed in. */
function Toast({ message, onClose, aboveDock }: { message: string; onClose: () => void; aboveDock: boolean }) {
  const t = useTranslate();
  const warn = WARNING_WORDS.test(message);
  useEffect(() => {
    const timer = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={cn('pointer-events-none fixed inset-x-0 z-2100 flex justify-center px-4 lg:bottom-4', aboveDock ? 'bottom-24' : 'bottom-4')}>
      <div
        key={message}
        role="status"
        aria-live="polite"
        className={cn(
          'fx-toast pointer-events-auto flex max-w-lg items-start gap-2.5 rounded-lg border-[1.5px] border-signal bg-slate-900 px-4 py-3 text-sm text-white shadow-[4px_4px_0_var(--signal)]',
          warn && 'fx-toast-warn',
        )}
      >
        <span
          className={cn(
            'fx-toast-icon relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            warn ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300',
          )}
        >
          {warn ? (
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 16 16" className="fx-toast-check h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8.5l3.2 3L13 4.5" />
            </svg>
          )}
        </span>
        <span className="leading-relaxed">{t(message)}</span>
        <button type="button" onClick={onClose} className="-mr-1 ml-2 shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-90" aria-label={t('Dismiss')}>
          <X className="h-4 w-4" />
        </button>
        <span className="fx-toast-progress" style={{ animationDuration: `${TOAST_MS}ms` }} aria-hidden="true" />
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
  const { theme, toggleTheme } = useAppTheme();
  const t = useTranslate();
  const civic = useCivicloop();
  const { tickets, logs, overrides, volunteers, liveAi, nowMs, clockOffsetHours } = civic;

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRole, setAuthRole] = useState<UserRole>('citizen');
  const [demoMode, setDemoMode] = useState(true);
  const [citizenTab, setCitizenTab] = useState<CitizenTab>('bounties');
  const [covTab, setCovTab] = useState<CoVTab>('bounties');
  const [adminAnchor, setAdminAnchor] = useState('brain');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [paidBounty, setPaidBounty] = useState<{ bounty: BountyInfo; ticketTitle: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const navItems: SidebarItem[] = citizen
    ? [
        { id: 'bounties', label: 'Bounty network', icon: HardHat, onSelect: () => setCitizenTab('bounties') },
        { id: 'report', label: 'Report an issue', icon: Camera, onSelect: () => setCitizenTab('report') },
        { id: 'reports', label: 'My reports', icon: CircleCheck, badge: myTickets.length, onSelect: () => setCitizenTab('reports') },
        { id: 'map', label: 'City map', icon: MapIcon, onSelect: () => setCitizenTab('map') },
      ]
    : volunteer
      ? [
          { id: 'bounties', label: 'Bounty missions', icon: HardHat, onSelect: () => setCovTab('bounties') },
          { id: 'operations', label: 'Department operations', icon: Route, onSelect: () => setCovTab('operations') },
        ]
      : sessionUser?.role === 'admin'
        ? [
            { id: 'brain', label: 'AI brain', icon: Brain, href: '#brain' },
            { id: 'live-map', label: 'Live map', icon: MapIcon, href: '#live-map' },
          ]
        : [];
  const activeNavId = citizen ? citizenTab : volunteer ? covTab : adminAnchor;
  // The welcome banner and KPI row belong to each role's home view; task tabs go straight to their content.
  const showOverview =
    sessionUser !== null && (citizen ? citizenTab === 'bounties' : volunteer ? covTab === 'operations' : true);
  const pageTitle = navItems.find((item) => item.id === activeNavId)?.label;
  const displayName = citizen ? citizen.displayName : volunteer ? volunteer.name : sessionUser?.role === 'admin' ? sessionUser.profile.name : '';

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

  const scrollToSection = (selector: string) => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
  const searchGroups: PaletteGroup[] = [
    {
      label: 'Go to',
      items: sessionUser
        ? navItems.map((item) => ({
            id: `nav-${item.id}`,
            label: t(item.label),
            hint: t('Workspace'),
            icon: item.icon,
            onRun: () => {
              setAdminAnchor(item.id);
              item.onSelect?.();
              if (item.href) scrollToSection(item.href);
            },
          }))
        : [
            { id: 'sec-loop', label: t('How the loop works'), hint: t('Section'), icon: Route, onRun: () => scrollToSection('#loop') },
            { id: 'sec-bounty', label: t('Bounty map'), hint: t('Section'), icon: MapIcon, onRun: () => scrollToSection('#bounty') },
            { id: 'sec-csr', label: t('CSR funding'), hint: t('Section'), icon: Sparkles, onRun: () => scrollToSection('#csr') },
          ],
    },
    {
      label: 'Actions',
      items: [
        ...(sessionUser ? [] : [{ id: 'act-report', label: t('Report an issue'), icon: Camera, onRun: () => openAuth('citizen') }]),
        ...(demoMode
          ? [
              { id: 'act-citizen', label: t('Switch to the demo citizen view'), icon: Users, onRun: () => quickSwitch('citizen') },
              { id: 'act-cov', label: t('Switch to the demo CoV view'), icon: HardHat, onRun: () => quickSwitch('volunteer') },
              { id: 'act-admin', label: t('Switch to the demo admin view'), icon: Brain, onRun: () => quickSwitch('admin') },
            ]
          : []),
        { id: 'act-theme', label: t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'), icon: Moon, onRun: toggleTheme },
        { id: 'act-demo', label: t(demoMode ? 'Turn off Quick Demo Mode' : 'Turn on Quick Demo Mode'), icon: FastForward, onRun: () => setDemoMode((value) => !value) },
      ],
    },
    {
      label: 'Reports',
      items: [...masters, ...localAreaTickets.filter((ticket) => !masters.includes(ticket))].map((ticket) => ({
        id: `ticket-${ticket.id}`,
        label: ticket.title,
        hint: `${ticket.referenceCode} · ${t(ticket.status)} · ${ticket.impactCount} ${t(ticket.impactCount === 1 ? 'citizen' : 'citizens')}`,
        keywords: `${ticket.category} ${ticket.location.address ?? ''} ${ticket.assignedDepartment}`,
        icon: Search,
        onRun: () => setSelectedTicketId(ticket.id),
      })),
    },
  ];

  const viewKey = !sessionUser ? 'landing' : `${sessionUser.role}-${citizen ? citizenTab : volunteer ? covTab : 'admin'}`;

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
    <div className={cn('app-shell flex min-h-full flex-1 flex-col text-slate-900', sessionUser && 'pb-24 lg:pb-0 lg:pl-72')}>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-3000 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg focus:not-sr-only"
      >
        Skip to content
      </a>
      {sessionUser && (
        <Sidebar
          items={navItems}
          activeId={activeNavId}
          onNavigate={setAdminAnchor}
          sectionLabel={sessionUser.role === 'citizen' ? 'Citizen' : sessionUser.role === 'volunteer' ? 'CoV' : 'Admin'}
          pulse={{ label: 'Live reports', value: telemetry.totalReports, sub: `${telemetry.slaBreached} SLA breaches` }}
        />
      )}
      <Header
        title={pageTitle}
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
        onOpenSearch={() => setSearchOpen(true)}
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

      <main
        id="main-content"
        className={cn(
          'flex-1',
          sessionUser
            ? 'mx-auto w-full max-w-384 px-3 py-5 sm:px-5 sm:py-7 lg:px-8'
            : 'w-full',
        )}
      >
        {/* Keyed per role and tab: each switch replays the blur-to-sharp sweep entrance. */}
        <div key={viewKey} className={cn('fx-view', sessionUser && 'space-y-6')}>
        {!sessionUser && (
          <>
            <section id="top" className="relative isolate overflow-hidden border-b-[1.5px] border-ink bg-paper">
              <HudFrame label="CIVICLOOP // GRID-07" readout="17.2844°N · 78.5651°E · ALT 512M" scan className="hidden lg:block" />
              <div className="relative mx-auto flex min-h-[calc(100svh-9.5rem)] max-w-384 flex-col justify-between gap-8 px-3 pt-10 sm:px-5 lg:gap-12 lg:px-8 lg:pt-14">
                <div className="relative z-3 max-w-4xl space-y-6 lg:max-w-[46%]" data-depth="" style={{ '--depth': 8 } as React.CSSProperties}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow"><ScrambleText text={t('CIVICSENSE · 5 AI AGENTS AT WORK')} delay={200} duration={1100} /></span>
                    <LiveIndicator label={t('Systems online')} />
                  </div>
                  <h1 className="text-[clamp(2.7rem,6.2vw,5.9rem)] font-extrabold leading-[0.9] tracking-[-0.045em] text-ink">
                    <SplitText text={t('Your neighborhood,')} delay={150} />
                    <br />
                    <span className="hero-mark"><SplitText text={t('better by design.')} startIndex={18} delay={150} gradient /></span>
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
                    {t('Report a local issue in seconds. Civicloop brings neighbors together, gets the right team on it, and keeps the fix accountable from first photo to final proof.')}
                  </p>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                    <button type="button" onClick={() => openAuth('citizen')} className="btn btn-primary btn-lg group" data-cursor-cta>
                      {t('Report an issue')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                    <button type="button" onClick={() => openAuth('volunteer')} className="btn btn-secondary btn-lg">
                      <HardHat className="h-4 w-4" /> {t('Join as a CoV')}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('Your identity stays private')}</span>
                    <span className="hidden h-1 w-1 bg-slate-400 sm:block" />
                    <span>{t('English · ಕನ್ನಡ · हिन्दी')}</span>
                  </div>
                </div>

                <CityScene className="scene-fade-left relative -mx-3 h-85 sm:-mx-5 sm:h-115 lg:absolute lg:inset-y-0 lg:left-[40%] lg:right-0 lg:-z-10 lg:mx-0 lg:h-auto" />

                <dl className="holo relative z-3 grid grid-cols-2 overflow-hidden border-[1.5px] border-b-0 border-ink bg-surface backdrop-blur-md lg:grid-cols-4 dark:bg-[rgb(6_9_24/72%)]">
                  <span className="fx-sweep" aria-hidden="true" style={{ '--sweep-delay': '2.4s' } as React.CSSProperties} />
                  {[
                    { label: t('Neighbors heard'), value: telemetry.totalReports, sub: `${telemetry.masterIssues} ${t('issues tracked')}`, icon: Users },
                    { label: t('Less duplicate noise'), value: `${telemetry.duplicateReductionPercent}%`, sub: `${telemetry.duplicatesMerged} ${t('reports combined')}`, icon: GitMerge },
                    { label: t('On-time accountability'), value: telemetry.autoEscalations, sub: t('automatic deadline escalations'), icon: Siren },
                    { label: t('Fixes with proof'), value: telemetry.proofVerified, sub: `${telemetry.proofRejected} ${t('proofs reviewed')}`, icon: Check },
                  ].map((stat, index) => (
                    <div
                      key={stat.label}
                      className={cn(
                        'stat-cell group p-4 sm:p-5',
                        index % 2 === 1 && 'border-l-[1.5px] border-ink',
                        (index === 2 || index === 3) && 'border-t-[1.5px] border-ink lg:border-t-0',
                        index === 2 && 'lg:border-l-[1.5px] lg:border-ink',
                      )}
                    >
                      <dt className="flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 group-hover:text-(--on-signal) sm:text-[11px]">
                        {stat.label}
                        <stat.icon className="h-4 w-4 shrink-0 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-125" aria-hidden="true" />
                      </dt>
                      <dd className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink group-hover:text-(--on-signal) sm:text-5xl">
                        <CountUp value={stat.value} />
                      </dd>
                      <div className="mt-1 text-[11px] text-slate-500 group-hover:text-(--on-signal)">{stat.sub}</div>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <div className="marquee overflow-hidden border-b-[1.5px] border-ink bg-slate-900 py-2.5 text-slate-50" aria-hidden="true">
              <div className="marquee-track flex gap-8 font-mono text-xs font-semibold uppercase tracking-[0.16em]">
                {[...Object.keys(CATEGORY_META), ...Object.keys(CATEGORY_META)].map((category, index) => (
                  <span key={`${category}-${index}`} className="flex shrink-0 items-center gap-8">
                    {category}
                    <span className="h-1.5 w-1.5 bg-[#ff5a1f]" />
                  </span>
                ))}
              </div>
            </div>

            <section id="loop" className="relative isolate mx-auto w-full max-w-384 overflow-hidden px-3 py-12 sm:px-5 lg:px-8 lg:py-16">
              <span className="fx-ghost-word fx-parallax right-0 top-4 text-[clamp(6rem,18vw,16rem)]" aria-hidden="true">LOOP</span>
              <div className="fx-scroll-rise mb-8 flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-3">
                  <span className="eyebrow"><ScrambleText text={t('How the loop works')} /></span>
                  <h2 className="max-w-2xl text-4xl font-extrabold leading-[0.95] text-ink sm:text-5xl">{t('A complaint that closes on evidence.')}</h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-slate-600">
                  {t('From a complaint inbox to a self-healing loop that closes on evidence.')}
                </p>
              </div>
              <ol className="reveal grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {LOOP_STEPS.map((step, index) => (
                  <li key={step.name} className="surface-card tilt group p-5">
                    <div className="flex items-start justify-between">
                      <span className="fx-z2 font-display text-6xl font-extrabold leading-none text-transparent [-webkit-text-stroke:1.5px_var(--ink)] transition-colors duration-300 group-hover:text-signal dark:[-webkit-text-stroke:1.5px_var(--signal)] dark:group-hover:filter-[drop-shadow(0_0_14px_var(--signal))]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <step.icon className="fx-z1 h-6 w-6 text-slate-500 transition-colors group-hover:text-ink dark:group-hover:text-signal" aria-hidden="true" />
                    </div>
                    <h3 className="fx-z1 mt-6 text-xl font-extrabold text-ink">{step.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{t(step.blurb)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="mx-auto w-full max-w-384 space-y-8 px-3 pb-12 sm:px-5 lg:px-8 lg:pb-16">
            <PitchBanner />


            <div id="bounty" className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
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
                stretchToColumn
              />
            </div>

            <div id="csr">
              <CsrFundingSection />
            </div>
            </div>
          </>
        )}

        {showOverview && (
          <>
            <CommandDeck
              name={displayName}
              role={sessionUser.role === 'citizen' ? 'Citizen' : sessionUser.role === 'volunteer' ? 'Community volunteer' : 'Super-admin'}
              blurb={
                sessionUser.role === 'admin'
                  ? 'Five agents are watching every ticket. Overrides you make teach the routing graph.'
                  : sessionUser.role === 'volunteer'
                    ? 'Pick a mission, fix it, and submit proof. Payout lands once the citizen signs off.'
                    : 'Report an issue, back a neighbor’s report, and watch it close with photo proof.'
              }
            />
            {/* Admin gets the richer telemetry grid inside the AI brain instead. */}
            {sessionUser?.role !== 'admin' && <KpiStrip telemetry={telemetry} />}
          </>
        )}

        {citizen && (
          <>

            {citizenTab === 'bounties' && (
              <div className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
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
                stretchToColumn
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

            {covTab === 'bounties' && (
              <div className="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
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
                  tickets={localAreaTickets}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={setSelectedTicketId}
                  userLocation={userLocation}
                  onLocateMe={setUserLocation}
                  depots={SEED_TOOL_DEPOTS}
                  title="Bounty missions near you"
                  showingDemoReports={showingDemoReports}
                  heightClass="h-[380px] sm:h-[480px] lg:h-[600px]"
                  stretchToColumn
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
            <div id="brain">
              <AIBrainDashboard tickets={tickets} overrides={overrides} logs={logs} liveAi={liveAi} />
            </div>
            <div id="live-map">
              <MapCard
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                userLocation={userLocation}
                onLocateMe={setUserLocation}
              />
            </div>
          </>
        )}
        </div>
      </main>

      <footer className="mt-8 border-t-[1.5px] border-ink bg-surface px-4 py-5 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-slate-500">
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

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} groups={searchGroups} />

      {selectedTicket && <TicketDrawer ticket={selectedTicket} logs={selectedLogs} onClose={() => setSelectedTicketId(null)} />}
      {toast && <Toast message={toast} onClose={dismissToast} aboveDock={sessionUser !== null} />}

      <UpiReceiptModal
        bounty={paidBounty?.bounty ?? null}
        ticketTitle={paidBounty?.ticketTitle ?? ''}
        volunteerUpiId={volunteers.find((entry) => entry.id === paidBounty?.bounty.claimedBy)?.upiId ?? null}
        onClose={() => setPaidBounty(null)}
      />
    </div>
  );
}
