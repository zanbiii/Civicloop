'use client';

import { useId, useState } from 'react';
import {
  Brain,
  Camera,
  ChevronDown,
  CircleCheck,
  Clock,
  Hammer,
  Inbox,
  LoaderCircle,
  MapPin,
  Shuffle,
  Siren,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import {
  CATEGORY_META,
  DEPARTMENTS,
  DEPARTMENT_META,
  SEVERITY_META,
  STATUS_META,
  type CivicProofVerification,
  type CivicTicket,
  type Department,
  type EvidencePhoto,
  type GeoPoint,
  type TicketStatus,
  type VolunteerProfile,
} from '@/types/civic';
import CameraCapture from '@/components/CameraCapture';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import GlideTabs from '@/components/GlideTabs';
import { cn } from '@/lib/cn';
import { useEscapeKey } from '@/lib/useEscapeKey';
import { useTranslate } from '@/components/AppLanguageProvider';
import { isDemoTicket } from '@/lib/demo';

interface CoVDashboardProps {
  cov: VolunteerProfile;
  tickets: CivicTicket[];
  /** Current clock (including any demo fast-forward), for SLA countdowns. */
  nowMs: number;
  onStartWork: (ticketId: string) => void;
  onReroute: (ticketId: string, toDepartment: Department, reason: string) => Promise<void>;
  onSubmitProof: (ticketId: string, afterPhoto: EvidencePhoto) => Promise<CivicProofVerification>;
  onSelectTicket?: (ticketId: string) => void;
}

type QueueTab = 'active' | 'awaiting' | 'closed';

const TAB_STATUSES: Record<QueueTab, TicketStatus[]> = {
  active: ['Submitted', 'Triaged', 'Assigned', 'In Progress', 'Reopened'],
  awaiting: ['Proof Submitted', 'Pending Citizen Confirmation'],
  closed: ['Resolved', 'Rejected'],
};

const STARTABLE: TicketStatus[] = ['Submitted', 'Triaged', 'Assigned', 'Reopened'];
const PROOFABLE: TicketStatus[] = ['Assigned', 'In Progress', 'Reopened'];

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function SlaCountdown({ ticket, nowMs }: { ticket: CivicTicket; nowMs: number }) {
  const t = useTranslate();
  const { sla } = ticket;
  if (sla.metAt) {
    return (
      <span className={cn('flex items-center gap-1 text-xs font-semibold', sla.health === 'breached' ? 'text-red-600' : 'text-emerald-600')}>
        <CircleCheck className="h-3.5 w-3.5" /> {t(sla.health === 'breached' ? 'Closed late' : 'SLA met')}
      </span>
    );
  }
  const remaining = new Date(sla.dueAt).getTime() - nowMs;
  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-600">
        <Siren className="h-3.5 w-3.5" /> {t('Breached')} {formatDuration(-remaining)} {t('ago')}
      </span>
    );
  }
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', sla.health === 'warning' ? 'text-amber-600' : 'text-slate-600')}>
      {sla.health === 'warning' ? <TriangleAlert className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {formatDuration(remaining)} {t('left of')} {sla.slaHours}h
    </span>
  );
}

function StatTile({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof Clock }) {
  return (
    <div className="surface-card p-3.5 transition hover:-translate-y-0.5">
      <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold', tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function RerouteDialog({
  ticket,
  onClose,
  onConfirm,
}: {
  ticket: CivicTicket;
  onClose: () => void;
  onConfirm: (toDepartment: Department, reason: string) => Promise<void>;
}) {
  const t = useTranslate();
  const options = DEPARTMENTS.filter((dept) => dept !== ticket.assignedDepartment);
  const [toDepartment, setToDepartment] = useState<Department>(options[0]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
  useEscapeKey(onClose);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(toDepartment, reason.trim() || `Wrong Department: this ${ticket.category.toLowerCase()} is a ${toDepartment} subject.`);
      onClose();
    } catch (rerouteError) {
      setError(rerouteError instanceof Error ? rerouteError.message : 'Re-routing failed. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop z-[2000]">
      <div role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} className="modal-panel max-w-md">
        <div className="modal-header">
          <h3 id={`${ids}-title`} className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
              <Shuffle className="h-4 w-4" />
            </span>
            {t('Flag wrong department')}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-600">
            {ticket.referenceCode} · {ticket.title}
          </p>
          <div>
            <label htmlFor={`${ids}-dept`} className="field-label">{t('Re-route to')}</label>
            <select
              id={`${ids}-dept`}
              value={toDepartment}
              onChange={(event) => setToDepartment(event.target.value as Department)}
              className="field px-3"
            >
              {options.map((dept) => (
                <option key={dept} value={dept}>
                  {DEPARTMENT_META[dept].icon} {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${ids}-reason`} className="field-label">{t('Why is this the wrong department?')}</label>
            <textarea
              id={`${ids}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={t('e.g. Sewage ingress into the storm-water line is a BWSSB subject, not SWM.')}
              className="field resize-none px-3"
            />
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
            <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              This triggers <strong>self-healing</strong>: the correction is written to the routing graph, so future{' '}
              {ticket.category} reports in {ticket.location.ward ?? 'this zone'} go straight to {toDepartment}.
            </span>
          </div>
          {error && (
            <p role="alert" className="field-error">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            aria-busy={saving}
            className="btn btn-primary"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('Re-route & teach the system')}
          </button>
        </div>
      </div>
    </div>
  );
}

const VERDICT_STYLE: Record<CivicProofVerification['verdict'], { box: string; icon: typeof CircleCheck; title: string }> = {
  verified: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CircleCheck,
    title: 'Verified — sent to the citizen for final confirmation',
  },
  rejected: {
    box: 'border-red-200 bg-red-50 text-red-800',
    icon: TriangleAlert,
    title: 'Rejected — the ticket stays open',
  },
  inconclusive: {
    box: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: TriangleAlert,
    title: 'Could not auto-verify — the citizen will confirm in person',
  },
};

function ScoreMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-800">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#2a78d6] transition-[width] duration-700 ease-out" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ProofResult({ ticket, verification }: { ticket: CivicTicket; verification: CivicProofVerification }) {
  const t = useTranslate();
  const style = VERDICT_STYLE[verification.verdict];
  const before = ticket.beforePhotos.find((photo) => photo.id === verification.beforePhotoId) ?? ticket.beforePhotos[0];
  const after = ticket.afterPhotos.find((photo) => photo.id === verification.afterPhotoId) ?? ticket.afterPhotos[ticket.afterPhotos.length - 1];

  return (
    <div className="space-y-3">
      <div role="status" className={cn('flex animate-fade-in items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold', style.box)}>
        <style.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t(style.title)}
      </div>
      {before && after && (
        <BeforeAfterSlider
          beforeUrl={before.url}
          afterUrl={after.url}
          beforeLabel={before.source === 'seed' ? t('Before · sample') : t('Before')}
          afterLabel={after.source === 'seed' ? t('After · sample') : t('After')}
        />
      )}
      <div className="grid grid-cols-3 gap-3">
        <ScoreMeter label={t('Same location')} value={verification.landmarkMatch} />
        <ScoreMeter label={t('Repair evidence')} value={verification.repairEvidence} />
        <ScoreMeter label={t('Confidence')} value={verification.confidence} />
      </div>
      <p className="text-xs leading-relaxed text-slate-600">{verification.summary}</p>
      {verification.landmarksMatched.length > 0 && (
        <ul className="space-y-0.5 text-xs text-emerald-700">
          {verification.landmarksMatched.map((landmark) => (
            <li key={landmark}>✓ {landmark}</li>
          ))}
        </ul>
      )}
      {verification.discrepancies.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-700">
          {verification.discrepancies.map((issue) => (
            <li key={issue}>✗ {issue}</li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-slate-400">
        {verification.model} · {verification.mode === 'live' ? 'live vision' : 'offline mode'}
      </p>
    </div>
  );
}

function ProofDialog({
  ticket,
  cov,
  onClose,
  onSubmit,
}: {
  ticket: CivicTicket;
  cov: VolunteerProfile;
  onClose: () => void;
  onSubmit: (afterPhoto: EvidencePhoto) => Promise<CivicProofVerification>;
}) {
  const t = useTranslate();
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'ok' | 'failed'>('idle');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ verification: CivicProofVerification; ticket: CivicTicket } | null>(null);
  const titleId = useId();
  useEscapeKey(onClose);

  const attachLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('failed');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyMeters: Math.round(position.coords.accuracy) });
        setGeoStatus('ok');
      },
      () => setGeoStatus('failed'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const verify = async () => {
    const afterPhoto = photos[0];
    if (!afterPhoto) return;
    setVerifying(true);
    setError(null);
    try {
      const verification = await onSubmit({ ...afterPhoto, geo: afterPhoto.geo ?? geo });
      setResult({ verification, ticket: { ...ticket, afterPhotos: [...ticket.afterPhotos, afterPhoto] } });
    } catch (proofError) {
      setError(proofError instanceof Error ? proofError.message : 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
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
            {t('Submit proof of repair')}
          </h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {result ? (
            <ProofResult ticket={result.ticket} verification={result.verification} />
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {t('No complaint closes without verified proof. Photograph the repaired spot from the same angle as the citizen’s photo — CivicProof compares fixed landmarks before the citizen is asked to confirm.')}
              </p>
              <CameraCapture
                photos={photos}
                onPhotosChange={setPhotos}
                kind="after"
                capturedBy={cov.id}
                geo={geo}
                maxPhotos={1}
                label={t('After photo')}
              />
              <div className="flex items-center gap-2 text-xs">
                {geoStatus === 'ok' ? (
                  <span role="status" className="flex animate-fade-in items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {t('Geotag attached')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={attachLocation}
                    disabled={geoStatus === 'locating'}
                    aria-busy={geoStatus === 'locating'}
                    className="btn btn-secondary btn-sm"
                  >
                    {geoStatus === 'locating' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                    {t('Attach my GPS location')}
                  </button>
                )}
                {geoStatus === 'failed' && <span className="text-amber-600">{t('Location unavailable — proof will carry no geotag.')}</span>}
              </div>
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
              {t('Done')}
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn btn-ghost">
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={verify}
                disabled={photos.length === 0 || verifying}
                aria-busy={verifying}
                className="btn btn-primary"
              >
                {verifying && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t(verifying ? 'CivicProof is comparing landmarks…' : 'Verify & resolve')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueRow({
  ticket,
  cov,
  nowMs,
  onStartWork,
  onReroute,
  onProof,
  onSelect,
  readOnly = false,
}: {
  ticket: CivicTicket;
  cov: VolunteerProfile;
  nowMs: number;
  onStartWork: () => void;
  onReroute: () => void;
  onProof: () => void;
  onSelect?: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const mine = ticket.assignedDepartment === cov.department;
  const selfHealed = Boolean(ticket.triage?.appliedOverrideId);
  const breached = ticket.sla.health === 'breached' && !ticket.sla.metAt;

  return (
    <div className="flex animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: SEVERITY_META[ticket.severity].pin }} />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <button type="button" onClick={onSelect} className="rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 transition hover:text-emerald-800 hover:underline dark:hover:text-[#86efc0]">
              {CATEGORY_META[ticket.category].icon} {ticket.title}
            </button>
            {readOnly && (
              <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                {t('Illustrative sample · read-only')}
              </span>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
              <span>{ticket.referenceCode}</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {ticket.location.address ?? ticket.location.ward ?? t('Pinned location')}
              </span>
              {ticket.impactCount > 1 && (
                <span className="flex items-center gap-0.5 font-semibold text-slate-700">
                  <Users className="h-3 w-3" /> {t('Reported by')} {ticket.impactCount} {t('citizens')}
                </span>
              )}
            </div>
          </div>
          <SlaCountdown ticket={ticket} nowMs={nowMs} />
        </div>

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
          {selfHealed && (
            <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              🧠 Self-healed routing
            </span>
          )}
          {ticket.proof?.verdict === 'rejected' && ticket.status !== 'Resolved' && (
            <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              {t('Last proof rejected')}
            </span>
          )}
          {!mine && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {DEPARTMENT_META[ticket.assignedDepartment].icon} {ticket.assignedDepartment}
            </span>
          )}
        </div>

        {mine && !readOnly && (
          <div className="mt-3 flex flex-wrap gap-2">
            {STARTABLE.includes(ticket.status) && (
              <button
                type="button"
                onClick={onStartWork}
                className="btn btn-neutral btn-sm"
              >
                <Hammer className="h-3.5 w-3.5" aria-hidden="true" /> {t('Start work')}
              </button>
            )}
            {PROOFABLE.includes(ticket.status) && (
              <button
                type="button"
                onClick={onProof}
                className="btn btn-primary btn-sm"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {t('Submit proof')}
              </button>
            )}
            {TAB_STATUSES.active.includes(ticket.status) && (
              <button
                type="button"
                onClick={onReroute}
                className="btn btn-secondary btn-sm"
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" /> {t('Wrong department? Re-route')}
              </button>
            )}
          </div>
        )}

        {(ticket.sla.escalationBriefing || ticket.proof) && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="mt-3 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-[#263631] dark:hover:text-[#f1f5f3]"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')} aria-hidden="true" />
            {t(expanded ? 'Hide details' : 'Escalation briefing & proof')}
          </button>
        )}
        {expanded && (
          <div className="mt-2 animate-slide-down space-y-3">
            {ticket.sla.escalationBriefing && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                <div className="font-semibold">{t('Escalated to')} {ticket.sla.escalatedTo}</div>
                <p className="mt-0.5 leading-relaxed">{ticket.sla.escalationBriefing}</p>
              </div>
            )}
            {ticket.proof && <ProofResult ticket={ticket} verification={ticket.proof} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoVDashboard({
  cov,
  tickets,
  nowMs,
  onStartWork,
  onReroute,
  onSubmitProof,
  onSelectTicket,
}: CoVDashboardProps) {
  const t = useTranslate();
  const [tab, setTab] = useState<QueueTab>('active');
  const [reroutingId, setReroutingId] = useState<string | null>(null);
  const [proofId, setProofId] = useState<string | null>(null);

  const inDepartment = tickets.filter(
    (ticket) => ticket.isMaster && !isDemoTicket(ticket) && ticket.assignedDepartment === cov.department,
  );
  const sampleTickets = tickets.filter(
    (ticket) => ticket.isMaster && isDemoTicket(ticket) && ticket.assignedDepartment === cov.department,
  );
  const showingReadOnlySamples = inDepartment.length === 0 && sampleTickets.length > 0 && tab === 'active';
  const displayedTickets = showingReadOnlySamples ? sampleTickets : inDepartment;
  const queue = displayedTickets
    .filter((ticket) => TAB_STATUSES[tab].includes(ticket.status))
    .sort(
      (a, b) =>
        SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank || b.sla.percentElapsed - a.sla.percentElapsed,
    );

  const active = inDepartment.filter((ticket) => TAB_STATUSES.active.includes(ticket.status));
  const reroutingTicket = tickets.find((ticket) => ticket.id === reroutingId) ?? null;
  const proofTicket = tickets.find((ticket) => ticket.id === proofId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {DEPARTMENT_META[cov.department].icon} {cov.department} · {t('CoV Operations')}
        </h2>
        <p className="text-xs text-slate-500">
          {cov.name} · {t(cov.designation ?? 'Community Volunteer')} · {cov.zone}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('Open in queue')} value={active.length} tone="text-slate-500" icon={Hammer} />
        <StatTile label={t('SLA warning')} value={active.filter((t) => t.sla.health === 'warning').length} tone="text-amber-600" icon={TriangleAlert} />
        <StatTile label={t('SLA breached')} value={active.filter((t) => t.sla.health === 'breached').length} tone="text-red-600" icon={Siren} />
        <StatTile
          label={t('Awaiting citizen')}
          value={inDepartment.filter((t) => TAB_STATUSES.awaiting.includes(t.status)).length}
          tone="text-emerald-600"
          icon={CircleCheck}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">
          {cov.department}
        </span>
        <GlideTabs
          ariaLabel={t('Department queue status')}
          value={tab}
          onChange={setTab}
          compact
          items={[
            { id: 'active', label: t('Active queue') },
            { id: 'awaiting', label: t('Awaiting citizen') },
            { id: 'closed', label: t('Closed') },
          ]}
        />
      </div>

      {showingReadOnlySamples && (
        <div role="status" className="flex animate-fade-in items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('No live reports are assigned to this department. Showing illustrative examples for preview only; they cannot be acted on.')}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="empty-state animate-fade-in py-10">
          <span className="empty-state-icon"><Inbox className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-sm font-semibold text-slate-800">
            {t(inDepartment.length === 0 ? 'No live reports in this queue.' : 'Nothing here right now.')}
          </p>
          {tab !== 'active' && (
            <button type="button" onClick={() => setTab('active')} className="btn btn-secondary btn-sm mt-1">
              {t('Active queue')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((ticket) => (
            <QueueRow
              key={ticket.id}
              ticket={ticket}
              cov={cov}
              nowMs={nowMs}
              onStartWork={() => onStartWork(ticket.id)}
              onReroute={() => setReroutingId(ticket.id)}
              onProof={() => setProofId(ticket.id)}
              onSelect={onSelectTicket ? () => onSelectTicket(ticket.id) : undefined}
              readOnly={showingReadOnlySamples}
            />
          ))}
        </div>
      )}

      {reroutingTicket && (
        <RerouteDialog
          ticket={reroutingTicket}
          onClose={() => setReroutingId(null)}
          onConfirm={(toDepartment, reason) => onReroute(reroutingTicket.id, toDepartment, reason)}
        />
      )}
      {proofTicket && (
        <ProofDialog
          ticket={proofTicket}
          cov={cov}
          onClose={() => setProofId(null)}
          onSubmit={(afterPhoto) => onSubmitProof(proofTicket.id, afterPhoto)}
        />
      )}
    </div>
  );
}
