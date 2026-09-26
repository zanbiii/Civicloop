'use client';

import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Camera,
  Clock,
  Flame,
  HardHat,
  Inbox,
  LoaderCircle,
  MapPin,
  Sparkles,
  Star,
  TriangleAlert,
  Trophy,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_META,
  DEPARTMENT_META,
  bountyTotal,
  type BountyStatus,
  type CivicProofVerification,
  type CivicTicket,
  type CsrFund,
  type EvidencePhoto,
  type GeoPoint,
  type SessionUser,
  type ToolDepot,
  type VolunteerProfile,
  SEVERITY_META,
  STATUS_META,
} from '@/types/civic';
import { findNearbyVolunteers, formatInr } from '@/lib/bounty';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import { cn } from '@/lib/cn';
import { useEscapeKey } from '@/lib/useEscapeKey';
import CameraCapture from '@/components/CameraCapture';
import { ProofResult } from '@/components/CoVDashboard';
import { useTranslate } from '@/components/AppLanguageProvider';
import { isDemoTicket } from '@/lib/demo';

const BOOST_AMOUNT_INR = 50;

type FeedTab = 'active' | 'all' | 'leaderboard' | 'depots';

const STATUS_LABEL: Record<BountyStatus, string> = {
  open: 'Open — unclaimed',
  claimed: 'Claimed',
  in_progress: 'In progress',
  pending_payout: 'Awaiting citizen confirmation',
  paid: 'Paid',
};

interface BountyDashboardProps {
  csrFund: CsrFund;
  volunteers: VolunteerProfile[];
  tickets: CivicTicket[];
  sessionUser: SessionUser | null;
  depots: ToolDepot[];
  onSelectTicket: (ticketId: string) => void;
  onAcceptMission: (ticketId: string) => void;
  onBoostBounty: (ticketId: string, amountInr: number) => void;
  onSubmitProof: (ticketId: string, afterPhoto: EvidencePhoto) => Promise<CivicProofVerification>;
  onSignIn: () => void;
}

function CsrWidget({ fund }: { fund: CsrFund }) {
  const t = useTranslate();
  const balancePercent = Math.round((fund.activeBalanceInr / fund.totalPoolInr) * 100);
  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg ring-1 ring-inset ring-emerald-200/60" aria-hidden="true">🏢</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {fund.sponsorName} ({fund.zone})
          </h3>
          <p className="text-[11px] text-slate-500">{t(fund.purpose)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-slate-600">{t('Active Bounty Balance')}</span>
          <span className="font-bold text-slate-900">
            {formatInr(fund.activeBalanceInr)} <span className="font-normal text-slate-400">/ {formatInr(fund.totalPoolInr)}</span>
          </span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={balancePercent} aria-label={t('Active Bounty Balance')}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${balancePercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-slate-200">
          <div className="text-sm font-bold text-emerald-700">💰 {formatInr(fund.disbursedToDateInr)}</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('Disbursed to Local Youth')}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-slate-200">
          <div className="text-sm font-bold text-slate-900">🛠️ {fund.activeVolunteerCount}</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('Active CoVs on Field')}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-slate-200">
          <div className="text-sm font-bold text-slate-900">⏱️ {fund.avgFixHours}h</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('vs')} {fund.govtBaselineDays}d {t('govt.')}</div>
        </div>
      </div>
    </section>
  );
}

function VolunteerProfileCard({ volunteer }: { volunteer: VolunteerProfile }) {
  const t = useTranslate();
  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
          <HardHat className="h-6 w-6 text-amber-700" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-slate-900">{volunteer.name}</h3>
            <span className="text-xs text-slate-400">({volunteer.badge})</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <span className="flex items-center gap-0.5 font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {volunteer.rating.toFixed(1)} / 5.0
            </span>
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                volunteer.tier === 'gold' && 'bg-amber-100 text-amber-700',
                volunteer.tier === 'silver' && 'bg-slate-200 text-slate-700',
                volunteer.tier === 'bronze' && 'bg-orange-100 text-orange-700',
              )}
            >
              🥇 {t(volunteer.tier)} {t('Tier')} {volunteer.tier === 'gold' && `(+₹100 ${t('Bonus')})`}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
        <span className="text-xs font-semibold text-emerald-700">{t('Lifetime earned')}</span>
        <span className="text-base font-extrabold text-emerald-700">{formatInr(volunteer.totalEarnedInr)}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{volunteer.completedMissions} {t('missions completed')} · {volunteer.zone}</p>
    </section>
  );
}

function LeaderboardTab({ volunteers, highlightId }: { volunteers: VolunteerProfile[]; highlightId?: string }) {
  const t = useTranslate();
  const ranked = [...volunteers].sort((a, b) => b.totalEarnedInr - a.totalEarnedInr);
  const medal = ['🥇', '🥈', '🥉'];
  if (ranked.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
        <p className="text-sm font-semibold text-slate-800">{t('No CoVs on the board yet')}</p>
        <p className="max-w-xs text-xs text-slate-500">{t('Completed missions will rank volunteers here.')}</p>
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {ranked.map((volunteer, index) => (
        <li
          key={volunteer.id}
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
          className={cn(
            'flex animate-slide-up items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm',
            volunteer.id === highlightId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200',
          )}
        >
          <span className="w-6 shrink-0 text-center text-base">{medal[index] ?? `#${index + 1}`}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {volunteer.name}
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                  volunteer.tier === 'gold' && 'bg-amber-100 text-amber-700',
                  volunteer.tier === 'silver' && 'bg-slate-200 text-slate-700',
                  volunteer.tier === 'bronze' && 'bg-orange-100 text-orange-700',
                )}
              >
                {t(volunteer.tier)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {volunteer.rating.toFixed(1)} · {volunteer.completedMissions} {t('missions')} ·{' '}
              {volunteer.zone}
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700">{formatInr(volunteer.totalEarnedInr)}</span>
        </li>
      ))}
    </ol>
  );
}

function DepotsTab({ depots }: { depots: ToolDepot[] }) {
  const t = useTranslate();
  if (depots.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon"><Wrench className="h-5 w-5" aria-hidden="true" /></span>
        <p className="text-sm font-semibold text-slate-800">{t('No tool depots in this area yet')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {depots.map((depot, index) => (
        <div
          key={depot.id}
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
          className="animate-slide-up rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:shadow-sm"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50" aria-hidden="true">
              <Wrench className="h-3.5 w-3.5 text-blue-600" />
            </span>
            {depot.name}
          </div>
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
            {depot.inventory.map((item) => (
              <li key={item.item} className="flex justify-between">
                <span>{item.item}</span>
                <span className="font-semibold text-slate-800">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MissionProofDialog({
  ticket,
  volunteerId,
  onClose,
  onSubmit,
}: {
  ticket: CivicTicket;
  volunteerId: string;
  onClose: () => void;
  onSubmit: (afterPhoto: EvidencePhoto) => Promise<CivicProofVerification>;
}) {
  const t = useTranslate();
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CivicProofVerification | null>(null);
  const titleId = useId();
  useEscapeKey(onClose);

  const attachLocation = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setGeo({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyMeters: Math.round(position.coords.accuracy) }),
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async () => {
    const afterPhoto = photos[0];
    if (!afterPhoto) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await onSubmit({ ...afterPhoto, geo: afterPhoto.geo ?? geo }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Verification failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop z-[2000]">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-panel soft-scrollbar max-h-[92vh] max-w-lg overflow-y-auto">
        <div className="modal-header">
          <h3 id={titleId} className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700" aria-hidden="true">
              <Camera className="h-4 w-4" />
            </span>
            {t('Submit fix proof')}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {result ? (
            <ProofResult ticket={{ ...ticket, afterPhotos: [...ticket.afterPhotos, photos[0]] }} verification={result} />
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {t('Photograph the repaired spot from roughly the same angle as the citizen’s original photo — CivicProof compares fixed landmarks before the payout releases.')}
              </p>
              <CameraCapture photos={photos} onPhotosChange={setPhotos} kind="after" capturedBy={volunteerId} geo={geo} maxPhotos={1} label="After photo" />
              <button
                type="button"
                onClick={attachLocation}
                className={cn('btn btn-sm', geo ? 'btn-soft' : 'btn-secondary')}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {geo ? t('Location attached') : t('Attach my GPS location')}
              </button>
              {error && (
                <p role="alert" className="field-error">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {result ? (
            <button type="button" onClick={onClose} className="btn btn-primary">
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={photos.length === 0 || busy}
                aria-busy={busy}
                className="btn btn-primary"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {busy ? 'CivicProof is comparing…' : 'Verify & submit'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  ticket,
  role,
  demoSample,
  nearbyCount,
  canSubmitProof,
  onSelect,
  onAccept,
  onBoost,
  onOpenProof,
  onSignIn,
}: {
  ticket: CivicTicket;
  role: SessionUser['role'] | null;
  demoSample: boolean;
  nearbyCount: number;
  canSubmitProof: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onBoost: () => void;
  onOpenProof: () => void;
  onSignIn: () => void;
}) {
  const t = useTranslate();
  const bounty = ticket.bounty!;
  const total = bountyTotal(bounty);
  const locationLabel = ticket.location.address ?? ticket.location.ward ?? 'Location on file';
  const photo = ticket.beforePhotos[0];
  const slaLabel = {
    on_track: 'On track',
    warning: 'Warning (≥75%)',
    breached: 'Breached',
    met: 'SLA met',
  }[ticket.sla.health];
  const slaColor = {
    on_track: 'bg-emerald-500',
    warning: 'bg-amber-500',
    breached: 'bg-red-500',
    met: 'bg-emerald-500',
  }[ticket.sla.health];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} · ${t('Bounty')} ${formatInr(total)}`}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-emerald-200 hover:shadow-[0_14px_34px_-22px_rgb(6_78_59_/45%)] dark:hover:border-[#28634c]"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="h-1.5 w-full shrink-0 sm:h-auto sm:w-1.5" style={{ backgroundColor: SEVERITY_META[ticket.severity].pin }} />
      {photo ? (
        <div className="relative aspect-[4/3] w-full shrink-0 bg-slate-100 sm:aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a data URL or remote upload */}
          <img
            src={photo.url}
            alt={ticket.title}
            className="absolute inset-0 h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />
          {demoSample && (
            <span className="absolute bottom-1 left-1 rounded bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {t('Sample')}
            </span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center bg-slate-50 text-3xl sm:aspect-video" aria-hidden="true">
          {CATEGORY_META[ticket.category].icon}
        </div>
      )}
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <span>{CATEGORY_META[ticket.category].icon} {t(ticket.category)}</span>
              <span>·</span>
              <span>{ticket.referenceCode}</span>
            </div>
            <h3 className="mt-1 text-sm font-bold leading-snug text-slate-900">{ticket.title}</h3>
          </div>
          <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-1.5 text-right ring-1 ring-inset ring-emerald-200/60">
            <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">{t('Bounty')}</div>
            <div className="text-sm font-extrabold text-emerald-800">{formatInr(total)}</div>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {demoSample ? t(locationLabel) : locationLabel}</span>
          <span>{DEPARTMENT_META[ticket.assignedDepartment]?.icon} {t(ticket.assignedDepartment)}</span>
          {ticket.impactCount > 1 && (
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t('Reported by')} {ticket.impactCount} {t('citizens')}</span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{ticket.description}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', SEVERITY_META[ticket.severity].badgeClass)}>
            {t(SEVERITY_META[ticket.severity].label)}
          </span>
          <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
            {t(ticket.status)}
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {t(STATUS_LABEL[bounty.status])}
          </span>
          {demoSample && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              {t('Illustrative sample — not a real report')}
            </span>
          )}
          {bounty.communityBonus > 0 && (
            <span className="flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" /> +{formatInr(bounty.communityBonus)} {t('boosted')}
            </span>
          )}
          {bounty.status === 'open' && nearbyCount > 0 && (
            <span className="flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              <HardHat className="h-3 w-3" /> {nearbyCount} CoV {t('nearby')}
            </span>
          )}
          {bounty.claimedByName && bounty.status !== 'paid' && (
            <span className="text-[10px] text-slate-400">{t('Claimed by')} {bounty.claimedByName}</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', slaColor)} />
          <span className="shrink-0 text-[10px] font-semibold text-slate-600">SLA · {t(slaLabel)}</span>
          <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full', slaColor)} style={{ width: `${Math.min(100, ticket.sla.percentElapsed)}%` }} />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{Math.min(100, ticket.sla.percentElapsed)}%</span>
        </div>

        {!demoSample && role === 'volunteer' && bounty.status === 'open' && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onAccept();
          }}
          className="btn btn-primary btn-block btn-wrap mt-3"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" /> {t('Accept Mission & Claim')} {formatInr(total)}
        </motion.button>
      )}

        {canSubmitProof && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onOpenProof();
          }}
          className="btn btn-primary btn-block btn-wrap mt-3"
        >
          <Camera className="h-4 w-4" aria-hidden="true" /> {t('Submit Fix Proof')}
        </motion.button>
      )}

        {!demoSample && role === 'citizen' && bounty.status !== 'paid' && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onBoost();
          }}
          className="btn btn-soft btn-block btn-wrap mt-3"
        >
          <Zap className="h-4 w-4" aria-hidden="true" /> {t('Boost Bounty')} (+{formatInr(BOOST_AMOUNT_INR)} {t('Pledge')})
        </motion.button>
      )}

        {!demoSample && !role && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSignIn();
          }}
          className="btn btn-secondary btn-block btn-wrap mt-3"
        >
          {t('Sign in or join to report, contribute or volunteer')}
        </button>
      )}
        {demoSample && <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800">{t('Sample data · read-only — mission actions are disabled.')}</p>}
      </div>
    </motion.div>
  );
}

export default function BountyDashboard({
  csrFund,
  volunteers,
  tickets,
  sessionUser,
  depots,
  onSelectTicket,
  onAcceptMission,
  onBoostBounty,
  onSubmitProof,
  onSignIn,
}: BountyDashboardProps) {
  const t = useTranslate();
  const [tab, setTab] = useState<FeedTab>('active');
  const [proofTicketId, setProofTicketId] = useState<string | null>(null);
  const role = sessionUser?.role ?? null;
  const myVolunteer = sessionUser?.role === 'volunteer' ? sessionUser.profile : null;
  const proofTicket = tickets.find((ticket) => ticket.id === proofTicketId) ?? null;

  const activeTasks = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.isMaster && ticket.bounty && ticket.bounty.status !== 'paid')
        .sort((a, b) => bountyTotal(b.bounty!) - bountyTotal(a.bounty!)),
    [tickets],
  );
  const allTasks = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.isMaster && ticket.bounty)
        .sort((a, b) => bountyTotal(b.bounty!) - bountyTotal(a.bounty!)),
    [tickets],
  );

  const tabs: Array<{ id: FeedTab; label: string; icon: typeof Flame; count?: number }> = [
    { id: 'active', label: t('Active bounties'), icon: Flame, count: activeTasks.length },
    { id: 'all', label: t('All'), icon: Users, count: allTasks.length },
    { id: 'leaderboard', label: t('Hall of fame'), icon: Trophy, count: volunteers.length },
    { id: 'depots', label: t('Tool depots'), icon: Building2, count: depots.length },
  ];

  return (
    <div className="space-y-4">
      <CsrWidget fund={csrFund} />
      {myVolunteer && <VolunteerProfileCard volunteer={myVolunteer} />}

      <section className="surface-card p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <nav aria-label="Bounty network" className="soft-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible lg:border-r lg:border-slate-100 lg:pr-3">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={cn(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition duration-150 active:scale-[0.98] lg:w-full',
                  tab === id
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#263631] dark:hover:text-[#f1f5f3]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <span className={cn('min-w-6 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums', tab === id ? 'bg-white' : 'bg-slate-100')}>{count}</span>
              </button>
            ))}
          </nav>

          <div key={tab} className="soft-scrollbar max-h-[560px] animate-fade-in space-y-2.5 overflow-y-auto pr-1">
          {(tab === 'active' || tab === 'all') &&
            ((tab === 'active' ? activeTasks : allTasks).length === 0 ? (
              <div className="empty-state my-2">
                <span className="empty-state-icon"><Inbox className="h-5 w-5" aria-hidden="true" /></span>
                <p className="text-sm font-semibold text-slate-800">{t('No open bounties right now — nice and clear out there.')}</p>
                {!role && (
                  <button type="button" onClick={onSignIn} className="btn btn-secondary btn-sm mt-2">
                    {t('Sign in or join to report, contribute or volunteer')}
                  </button>
                )}
              </div>
            ) : (
              (tab === 'active' ? activeTasks : allTasks).map((ticket) => (
                <TaskCard
                  key={ticket.id}
                  ticket={ticket}
                  role={role}
                  demoSample={isDemoTicket(ticket)}
                  nearbyCount={findNearbyVolunteers(ticket.location, volunteers).length}
                  canSubmitProof={Boolean(myVolunteer && ticket.bounty?.status === 'in_progress' && ticket.bounty.claimedBy === myVolunteer.id)}
                  onSelect={() => onSelectTicket(ticket.id)}
                  onAccept={() => onAcceptMission(ticket.id)}
                  onBoost={() => onBoostBounty(ticket.id, BOOST_AMOUNT_INR)}
                  onOpenProof={() => setProofTicketId(ticket.id)}
                  onSignIn={onSignIn}
                />
              ))
            ))}
          {tab === 'leaderboard' && <LeaderboardTab volunteers={volunteers} highlightId={myVolunteer?.id} />}
          {tab === 'depots' && <DepotsTab depots={depots} />}
          </div>
        </div>
      </section>

      <p className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
        <Clock className="h-3 w-3" /> {t('Bounty figures are demo-illustrative CSR pool estimates, not live financial accounting.')}
      </p>

      {proofTicket && myVolunteer && (
        <MissionProofDialog
          ticket={proofTicket}
          volunteerId={myVolunteer.id}
          onClose={() => setProofTicketId(null)}
          onSubmit={(afterPhoto) => onSubmitProof(proofTicket.id, afterPhoto)}
        />
      )}
    </div>
  );
}
