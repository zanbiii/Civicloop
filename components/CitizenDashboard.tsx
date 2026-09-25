'use client';

import { useState } from 'react';
import { Camera, CheckCheck, Clock, MapPin, Plus, Star, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react';
import { CATEGORY_META, PRAISE_CHIPS, SEVERITY_META, STATUS_META, type CivicTicket, type PublicReporter } from '@/types/civic';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import { cn } from '@/lib/cn';

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

function timeAgo(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function SlaStatusLine({ ticket }: { ticket: CivicTicket }) {
  const { sla } = ticket;
  if (sla.metAt) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCheck className="h-3.5 w-3.5" /> Resolved within {sla.slaHours}h SLA
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3.5 w-3.5" /> {sla.slaHours}h {ticket.severity} SLA
        </span>
        {sla.health === 'breached' ? (
          <span className="rounded border border-red-400 bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            SLA Breached · Auto-Escalated
          </span>
        ) : (
          <span className="font-semibold text-slate-600">{Math.min(100, sla.percentElapsed)}% elapsed</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', SLA_BAR_COLOR[sla.health])} style={{ width: `${Math.min(100, sla.percentElapsed)}%` }} />
      </div>
    </div>
  );
}

function SupportRow({ onSupport }: { onSupport: (note: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [supported, setSupported] = useState(false);

  if (supported) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <CheckCheck className="h-3.5 w-3.5" /> Added — thanks for confirming
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <ThumbsUp className="h-3.5 w-3.5" /> I see this too
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note (e.g. worse after rain)"
        className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-500"
      />
      <button
        type="button"
        onClick={() => {
          onSupport(note.trim() || null);
          setSupported(true);
        }}
        className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
      >
        Confirm
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
  const photo = ticket.beforePhotos[0];
  const afterPhoto = ticket.afterPhotos[0];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_22px_-18px_rgb(15_23_42_/30%)] transition hover:border-emerald-200">
      <div className="flex gap-3">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL
          <img
            src={photo.url}
            alt={ticket.title}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
            onError={(event) => {
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect?.(ticket.id)}
            className="text-left text-sm font-semibold text-slate-900 hover:underline"
          >
            {CATEGORY_META[ticket.category].icon} {ticket.title}
          </button>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{ticket.location.address ?? ticket.location.ward ?? 'Location on file'}</span>
            <span>· {ticket.referenceCode}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', SEVERITY_META[ticket.severity].badgeClass)}>
              {SEVERITY_META[ticket.severity].label}
            </span>
            <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', STATUS_META[ticket.status].badgeClass)}>
              {ticket.status}
            </span>
            {ticket.impactCount > 1 && (
              <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                <Users className="h-3 w-3" /> {ticket.impactCount} citizens
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
          CoV submitted proof of repair {timeAgo(afterPhoto.capturedAt)}.
        </div>
      )}

      {onConfirmClick && (
        <button
          type="button"
          onClick={onConfirmClick}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          <CheckCheck className="h-4 w-4" /> Was this actually fixed?
        </button>
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
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [praiseChips, setPraiseChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const afterPhoto = ticket.afterPhotos[0];
  const beforePhoto = ticket.beforePhotos[0];

  const toggleChip = (chip: string) =>
    setPraiseChips((current) => (current.includes(chip) ? current.filter((c) => c !== chip) : [...current, chip]));

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Confirm the fix</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <p className="text-sm text-slate-600">{ticket.title}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {beforePhoto && (
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Before</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
                <img
                  src={beforePhoto.url}
                  alt="Before"
                  className="aspect-video w-full rounded-lg object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
            )}
            {afterPhoto && (
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">After</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
                <img
                  src={afterPhoto.url}
                  alt="After"
                  className="aspect-video w-full rounded-lg object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">How would you rate the fix?</span>
            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} stars`}>
                  <Star className={cn('h-7 w-7', rating && value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                </button>
              ))}
            </div>
            {ticket.bounty?.claimedByName && rating !== null && rating < 5 && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                {ticket.bounty.claimedByName} keeps their 4.8★+ Gold Tier bonus as long as their average stays there.
              </p>
            )}
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">One-tap praise (optional)</span>
            <div className="flex flex-wrap gap-1.5">
              {PRAISE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    praiseChips.includes(chip)
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Comment (optional)</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Anything the CoV or other citizens should know?"
              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onSubmit({ decision: 'rejected', rating, praiseChips, comment: comment.trim() || null })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            <ThumbsDown className="h-4 w-4" /> Not fixed
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ decision: 'approved', rating, praiseChips, comment: comment.trim() || null })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ThumbsUp className="h-4 w-4" /> Looks good
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
  const [confirmingTicketId, setConfirmingTicketId] = useState<string | null>(null);
  const confirmingTicket = myTickets.find((ticket) => ticket.id === confirmingTicketId) ?? null;

  const pendingCount = myTickets.filter((ticket) => ticket.status === 'Pending Citizen Confirmation').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">My reports</h2>
          <p className="mt-1 text-xs text-slate-500">
            Signed in as {reporter.displayName} · {myTickets.length} report{myTickets.length === 1 ? '' : 's'}
            {pendingCount > 0 ? ` · ${pendingCount} awaiting your confirmation` : ''}
          </p>
        </div>
        {onNewReport && (
          <button
            type="button"
            onClick={onNewReport}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900 sm:px-4 sm:text-sm"
          >
            <Plus className="h-4 w-4" /> Report an issue
          </button>
        )}
      </div>

      {myTickets.length === 0 ? (
        <div className="surface-card flex flex-col items-center px-5 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MapPin className="h-6 w-6" /></span>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Your reports will show up here</h3>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">Start with a photo or a quick description. We&apos;ll keep you updated all the way to a verified fix.</p>
          {onNewReport && (
            <button type="button" onClick={onNewReport} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900">
              <Plus className="h-4 w-4" /> Report your first issue
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
              onConfirmClick={ticket.status === 'Pending Citizen Confirmation' ? () => setConfirmingTicketId(ticket.id) : undefined}
            />
          ))}
        </div>
      )}

      {nearbyTickets.length > 0 && (
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">Also happening nearby</h3>
          <p className="mb-3 mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Seeing the same problem? Add yourself as a co-reporter instead of filing a new ticket — it raises the issue&apos;s
            priority.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {nearbyTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onSelect={onSelectTicket}
                footer={<SupportRow onSupport={(note) => onSupportTicket(ticket.id, note)} />}
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
