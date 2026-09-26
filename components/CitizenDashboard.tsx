'use client';

import { useId, useState } from 'react';
import { Camera, CheckCheck, Clock, MapPin, Plus, Star, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react';
import { CATEGORY_META, PRAISE_CHIPS, SEVERITY_META, STATUS_META, type CivicTicket, type PublicReporter } from '@/types/civic';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import { cn } from '@/lib/cn';
import { useEscapeKey } from '@/lib/useEscapeKey';
import { useTranslate } from '@/components/AppLanguageProvider';
import { isDemoTicket } from '@/lib/demo';

export interface CitizenConfirmationInput {
  decision: 'approved' | 'rejected';
  rating: 1 | 2 | 3 | 4 | 5 | null;
  praiseChips: string[];
  comment: string | null;
}

interface CitizenDashboardProps {
  reporter: PublicReporter;
  myTickets: CivicTicket[];
  nearbyTickets: CivicTicket[];
  onSupportTicket: (ticketId: string, note: string | null) => void;
  onConfirmResolution: (ticketId: string, confirmation: CitizenConfirmationInput) => void;
  onSelectTicket?: (ticketId: string) => void;
  onNewReport?: () => void;
}

const SLA_BAR_COLOR: Record<CivicTicket['sla']['health'], string> = {
  on_track: 'bg-emerald-500',
  warning: 'bg-amber-500',
  breached: 'bg-red-600',
  met: 'bg-emerald-500',
};

function timeAgo(iso: string, t: (text: string) => string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return t('just now');
  if (hours < 24) return `${Math.round(hours)}h ${t('ago')}`;
  return `${Math.round(hours / 24)}d ${t('ago')}`;
}

function SlaStatusLine({ ticket }: { ticket: CivicTicket }) {
  const t = useTranslate();
  const { sla } = ticket;
  if (sla.metAt) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCheck className="h-3.5 w-3.5" /> {t('Resolved within')} {sla.slaHours}h SLA
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {sla.slaHours}h {t(ticket.severity)} SLA
        </span>
        {sla.health === 'breached' ? (
          <span className="rounded border border-red-400 bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {t('SLA Breached · Auto-Escalated')}
          </span>
        ) : (
          <span className="font-semibold tabular-nums text-slate-600">{Math.min(100, sla.percentElapsed)}% elapsed</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', SLA_BAR_COLOR[sla.health])} style={{ width: `${Math.min(100, sla.percentElapsed)}%` }} />
      </div>
    </div>
  );
}

function SupportRow({ onSupport }: { onSupport: (note: string | null) => void }) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [supported, setSupported] = useState(false);

  if (supported) {
    return (
      <span role="status" className="flex w-fit animate-fade-in items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('Added — thanks for confirming')}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> {t('I see this too')}
      </button>
    );
  }

  return (
    <div className="flex animate-fade-in items-center gap-2">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t('Optional note (e.g. worse after rain)')}
        aria-label={t('Optional note (e.g. worse after rain)')}
        autoFocus
        className="field min-w-0 rounded-[0.625rem] px-2.5 py-1.5 text-xs"
      />
      <button
        type="button"
        onClick={() => {
          onSupport(note.trim() || null);
          setSupported(true);
        }}
        className="btn btn-primary btn-sm shrink-0"
      >
        {t('Confirm')}
      </button>
    </div>
  );
}

function TicketCard({
  ticket,
  onSelect,
  onConfirmClick,
  footer,
}: {
  ticket: CivicTicket;
  onSelect?: (id: string) => void;
  onConfirmClick?: () => void;
  footer?: React.ReactNode;
}) {
  const t = useTranslate();
  const photo = ticket.beforePhotos[0];
  const afterPhoto = ticket.afterPhotos[0];

  return (
    <div className="interactive-card animate-slide-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_22px_-18px_rgb(15_23_42_/30%)]">
      <div className="flex gap-3">
        {photo && (
          <div className="relative h-16 w-16 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
            <img
              src={photo.url}
              alt={photo.source === 'seed' ? `${t('Sample photo')}: ${ticket.title}` : ticket.title}
              className="h-full w-full rounded-lg object-cover"
              onError={(event) => {
                event.currentTarget.src = PLACEHOLDER_IMAGE;
              }}
            />
            {photo.source === 'seed' && (
              <span className="absolute bottom-0 inset-x-0 rounded-b-lg bg-slate-950/75 px-1 py-0.5 text-center text-[9px] font-semibold text-white">
                {t('Sample')}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect?.(ticket.id)}
            className="rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 transition hover:text-emerald-800 hover:underline dark:hover:text-[#86efc0]"
          >
            {CATEGORY_META[ticket.category].icon} {ticket.title}
          </button>
          {isDemoTicket(ticket) && (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800">
              {t('Illustrative sample — not a real report')}
            </span>
          )}
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{ticket.location.address ?? ticket.location.ward ?? t('Location on file')}</span>
            <span>· {ticket.referenceCode}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', SEVERITY_META[ticket.severity].badgeClass)}>
              {t(SEVERITY_META[ticket.severity].label)}
            </span>
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
              {t(ticket.status)}
            </span>
            {ticket.impactCount > 1 && (
              <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                <Users className="h-3 w-3" /> {ticket.impactCount} {t('citizens')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <SlaStatusLine ticket={ticket} />
      </div>

      {afterPhoto && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
          <Camera className="h-3.5 w-3.5 shrink-0" />
          {afterPhoto.source === 'seed'
            ? t('Sample repair photo in demo data.')
            : `${t('CoV submitted proof of repair')} ${timeAgo(afterPhoto.capturedAt, t)}.`}
        </div>
      )}

      {onConfirmClick && !isDemoTicket(ticket) && (
        <button
          type="button"
          onClick={onConfirmClick}
          className="btn btn-attention btn-block btn-wrap mt-3"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> {t('Was this actually fixed?')}
        </button>
      )}

      {isDemoTicket(ticket) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          {t('Sample reports cannot be changed, confirmed, boosted, or claimed.')}
        </p>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function ConfirmationDialog({
  ticket,
  onClose,
  onSubmit,
}: {
  ticket: CivicTicket;
  onClose: () => void;
  onSubmit: (confirmation: CitizenConfirmationInput) => void;
}) {
  const t = useTranslate();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [praiseChips, setPraiseChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const afterPhoto = ticket.afterPhotos[0];
  const beforePhoto = ticket.beforePhotos[0];
  const titleId = useId();
  const commentId = useId();
  useEscapeKey(onClose);

  const toggleChip = (chip: string) =>
    setPraiseChips((current) => (current.includes(chip) ? current.filter((c) => c !== chip) : [...current, chip]));

  return (
    <div className="modal-backdrop z-[2000]">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-panel max-w-md">
        <div className="modal-header">
          <h3 id={titleId} className="text-base font-bold text-slate-900">{t('Confirm the fix')}</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="soft-scrollbar max-h-[70vh] overflow-y-auto p-5">
          <p className="text-sm text-slate-600">{ticket.title}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {beforePhoto && (
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">{t('Before')}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
                <img
                  src={beforePhoto.url}
                  alt={t('Before')}
                  className="aspect-video w-full rounded-lg object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
            )}
            {afterPhoto && (
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">{t('After')}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
                <img
                  src={afterPhoto.url}
                  alt={t('After')}
                  className="aspect-video w-full rounded-lg object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <span className="field-label">{t('How would you rate the fix?')}</span>
            <div className="flex gap-1" role="group" aria-label={t('How would you rate the fix?')}>
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} stars`}
                  aria-pressed={rating === value}
                  className="rounded-lg p-0.5 transition duration-150 hover:scale-110 active:scale-95"
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-colors',
                      rating && value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300',
                    )}
                  />
                </button>
              ))}
            </div>
            {ticket.bounty?.claimedByName && rating !== null && rating < 5 && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                {ticket.bounty.claimedByName} {t('keeps their 4.8★+ Gold Tier bonus as long as their average stays there.')}
              </p>
            )}
          </div>

          <div className="mt-4">
            <span className="field-label">{t('One-tap praise (optional)')}</span>
            <div className="flex flex-wrap gap-1.5">
              {PRAISE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  aria-pressed={praiseChips.includes(chip)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150 active:scale-95',
                    praiseChips.includes(chip)
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-[#263631]',
                  )}
                >
                  {t(chip)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor={commentId} className="field-label">{t('Comment (optional)')}</label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder={t('Anything the CoV or other citizens should know?')}
              className="field resize-none px-3"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={() => onSubmit({ decision: 'rejected', rating, praiseChips, comment: comment.trim() || null })}
            className="btn btn-danger flex-1"
          >
            <ThumbsDown className="h-4 w-4" aria-hidden="true" /> {t('Not fixed')}
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ decision: 'approved', rating, praiseChips, comment: comment.trim() || null })}
            className="btn btn-primary flex-1"
          >
            <ThumbsUp className="h-4 w-4" aria-hidden="true" /> {t('Looks good')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CitizenDashboard({
  reporter,
  myTickets,
  nearbyTickets,
  onSupportTicket,
  onConfirmResolution,
  onSelectTicket,
  onNewReport,
}: CitizenDashboardProps) {
  const t = useTranslate();
  const [confirmingTicketId, setConfirmingTicketId] = useState<string | null>(null);
  const confirmingTicket = myTickets.find((ticket) => ticket.id === confirmingTicketId) ?? null;

  const pendingCount = myTickets.filter((ticket) => ticket.status === 'Pending Citizen Confirmation').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{t('My reports')}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t('Signed in as')} {reporter.displayName} · {myTickets.length} {t(myTickets.length === 1 ? 'report' : 'reports')}
            {pendingCount > 0 ? ` · ${pendingCount} ${t('awaiting your confirmation')}` : ''}
          </p>
        </div>
        {onNewReport && (
          <button
            type="button"
            onClick={onNewReport}
            className="btn btn-primary shrink-0 px-3.5 text-xs font-bold sm:px-4 sm:text-sm"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('Report an issue')}
          </button>
        )}
      </div>

      {myTickets.length === 0 ? (
        <div className="surface-card flex animate-fade-in flex-col items-center px-5 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/50 dark:ring-[#16382d]/40"><MapPin className="h-6 w-6" aria-hidden="true" /></span>
          <h3 className="mt-4 text-sm font-bold text-slate-900">{t('Your reports will show up here')}</h3>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{t('Start with a photo or a quick description. We’ll keep you updated all the way to a verified fix.')}</p>
          {onNewReport && (
            <button type="button" onClick={onNewReport} className="btn btn-primary mt-5">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('Report your first issue')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onSelect={onSelectTicket}
              onConfirmClick={
                ticket.status === 'Pending Citizen Confirmation' && !isDemoTicket(ticket)
                  ? () => setConfirmingTicketId(ticket.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {nearbyTickets.length > 0 && (
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">{t('Also happening nearby')}</h3>
          <p className="mb-3 mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            {t('Seeing the same problem? Add yourself as a co-reporter instead of filing a new ticket — it raises the issue’s priority.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {nearbyTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onSelect={onSelectTicket}
                footer={isDemoTicket(ticket)
                  ? undefined
                  : <SupportRow onSupport={(note) => onSupportTicket(ticket.id, note)} />}
              />
            ))}
          </div>
        </div>
      )}

      {confirmingTicket && (
        <ConfirmationDialog
          ticket={confirmingTicket}
          onClose={() => setConfirmingTicketId(null)}
          onSubmit={(confirmation) => {
            onConfirmResolution(confirmingTicket.id, confirmation);
            setConfirmingTicketId(null);
          }}
        />
      )}
    </div>
  );
}
