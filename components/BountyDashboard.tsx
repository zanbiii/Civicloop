'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Camera,
  Clock,
  Flame,
  HardHat,
  LoaderCircle,
  MapPin,
  Sparkles,
  Star,
  Trophy,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_META,
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
} from '@/types/civic';
import { findNearbyVolunteers, formatInr } from '@/lib/bounty';
import { cn } from '@/lib/cn';
import CameraCapture from '@/components/CameraCapture';
import { ProofResult } from '@/components/CoVDashboard';

const BOOST_AMOUNT_INR = 50;

type FeedTab = 'active' | 'leaderboard' | 'depots';

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
  const balancePercent = Math.round((fund.activeBalanceInr / fund.totalPoolInr) * 100);
  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🏢</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {fund.sponsorName} ({fund.zone})
          </h3>
          <p className="text-[11px] text-slate-500">{fund.purpose}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-slate-600">Active Bounty Balance</span>
          <span className="font-bold text-slate-900">
            {formatInr(fund.activeBalanceInr)} <span className="font-normal text-slate-400">/ {formatInr(fund.totalPoolInr)}</span>
          </span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${balancePercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="text-sm font-bold text-emerald-700">💰 {formatInr(fund.disbursedToDateInr)}</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">Disbursed to Local Youth</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="text-sm font-bold text-slate-900">🛠️ {fund.activeVolunteerCount}</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">Active CoVs on Field</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="text-sm font-bold text-slate-900">⏱️ {fund.avgFixHours}h</div>
          <div className="mt-0.5 text-[10px] leading-tight text-slate-500">vs {fund.govtBaselineDays}d govt.</div>
        </div>
      </div>
    </section>
  );
}

function VolunteerProfileCard({ volunteer }: { volunteer: VolunteerProfile }) {
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
              🥇 {volunteer.tier} Tier {volunteer.tier === 'gold' && '(+₹100 Bonus)'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
        <span className="text-xs font-semibold text-emerald-700">Lifetime earned</span>
        <span className="text-base font-extrabold text-emerald-700">{formatInr(volunteer.totalEarnedInr)}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{volunteer.completedMissions} missions completed · {volunteer.zone}</p>
    </section>
  );
}

function LeaderboardTab({ volunteers, highlightId }: { volunteers: VolunteerProfile[]; highlightId?: string }) {
  const ranked = [...volunteers].sort((a, b) => b.totalEarnedInr - a.totalEarnedInr);
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className="space-y-2">
      {ranked.map((volunteer, index) => (
        <div
          key={volunteer.id}
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            volunteer.id === highlightId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white',
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
                {volunteer.tier}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {volunteer.rating.toFixed(1)} · {volunteer.completedMissions} missions ·{' '}
              {volunteer.zone}
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold text-emerald-700">{formatInr(volunteer.totalEarnedInr)}</span>
        </div>
      ))}
    </div>
  );
}

function DepotsTab({ depots }: { depots: ToolDepot[] }) {
  return (
    <div className="space-y-2">
      {depots.map((depot) => (
        <div key={depot.id} className="rounded-xl border border-slate-100 bg-white p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Wrench className="h-4 w-4 text-blue-600" /> {depot.name}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
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
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CivicProofVerification | null>(null);

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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Camera className="h-4 w-4" /> Submit fix proof
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {result ? (
            <ProofResult ticket={{ ...ticket, afterPhotos: [...ticket.afterPhotos, photos[0]] }} verification={result} />
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Photograph the repaired spot from roughly the same angle as the citizen&apos;s original photo — CivicProof compares
                fixed landmarks before the payout releases.
              </p>
              <CameraCapture photos={photos} onPhotosChange={setPhotos} kind="after" capturedBy={volunteerId} geo={geo} maxPhotos={1} label="After photo" />
              <button
                type="button"
                onClick={attachLocation}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="h-3.5 w-3.5" /> {geo ? 'Location attached' : 'Attach my GPS location'}
              </button>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          {result ? (
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={photos.length === 0 || busy}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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
  nearbyCount: number;
  canSubmitProof: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onBoost: () => void;
  onOpenProof: () => void;
  onSignIn: () => void;
}) {
  const bounty = ticket.bounty!;
  const total = bountyTotal(bounty);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_22px_-18px_rgb(15_23_42_/30%)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {CATEGORY_META[ticket.category].icon} {ticket.category}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" /> {ticket.location.address ?? ticket.location.ward ?? 'Location on file'}
          </div>
          {ticket.impactCount > 1 && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Users className="h-3 w-3" /> {ticket.impactCount} Neighbors Supported
            </div>
          )}
        </div>
        <motion.span
          className="shrink-0 whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1.5 text-right text-xs font-bold text-white shadow-[0_0_14px_rgba(16,185,129,0.55)]"
          animate={{ boxShadow: ['0 0 8px rgba(16,185,129,0.4)', '0 0 16px rgba(16,185,129,0.7)', '0 0 8px rgba(16,185,129,0.4)'] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          {formatInr(total)}
        </motion.span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-500">
          {STATUS_LABEL[bounty.status]}
        </span>
        {bounty.communityBonus > 0 && (
          <span className="flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
            <Sparkles className="h-3 w-3" /> +{formatInr(bounty.communityBonus)} boosted
          </span>
        )}
        {bounty.status === 'open' && nearbyCount > 0 && (
          <span className="flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
            <HardHat className="h-3 w-3" /> {nearbyCount} CoV{nearbyCount === 1 ? '' : 's'} nearby
          </span>
        )}
        {bounty.claimedByName && bounty.status !== 'paid' && (
          <span className="text-slate-400">Claimed by {bounty.claimedByName}</span>
        )}
      </div>

      {role === 'volunteer' && bounty.status === 'open' && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onAccept();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Wrench className="h-4 w-4" /> Accept Mission &amp; Claim {formatInr(total)}
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Camera className="h-4 w-4" /> Submit Fix Proof
        </motion.button>
      )}

      {role === 'citizen' && bounty.status !== 'paid' && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onBoost();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <Zap className="h-4 w-4" /> Boost Bounty (+{formatInr(BOOST_AMOUNT_INR)} Pledge)
        </motion.button>
      )}

      {!role && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSignIn();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Sign in or join to report, contribute or volunteer
        </button>
      )}
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

  return (
    <div className="space-y-4">
      <CsrWidget fund={csrFund} />
      {myVolunteer && <VolunteerProfileCard volunteer={myVolunteer} />}

      <section className="surface-card p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1 text-[10px] font-semibold sm:text-xs">
          {(
            [
              ['active', '🔥 Active Bounties', Flame],
              ['leaderboard', '🏆 Hall of Fame', Trophy],
              ['depots', '🛠️ Tool Depots', Building2],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              role="tab"
              aria-selected={tab === id}
              className={cn('flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 py-2 transition sm:gap-1.5', tab === id ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:text-slate-800')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="soft-scrollbar mt-4 max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
          {tab === 'active' &&
            (activeTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No open bounties right now — nice and clear out there.</p>
            ) : (
              activeTasks.map((ticket) => (
                <TaskCard
                  key={ticket.id}
                  ticket={ticket}
                  role={role}
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
      </section>

      <p className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
        <Clock className="h-3 w-3" /> Bounty figures are demo-illustrative CSR pool estimates, not live financial accounting.
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
