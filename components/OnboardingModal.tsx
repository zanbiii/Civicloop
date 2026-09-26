'use client';

import { useState } from 'react';
import { ArrowRight, Bot, Camera, CheckCheck, ChevronLeft, LoaderCircle, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { GeoPoint } from '@/types/civic';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';

interface OnboardingModalProps {
  open: boolean;
  onComplete: (result: { locationGranted: boolean; location: GeoPoint | null }) => void;
}

type Step = 'privacy' | 'location' | 'tour-1' | 'tour-2' | 'tour-3';
const STEPS: Step[] = ['privacy', 'location', 'tour-1', 'tour-2', 'tour-3'];

const TOUR_CARDS: Array<{ icon: typeof Camera; title: string; body: string }> = [
  {
    icon: Camera,
    title: 'Report in seconds',
    body: 'Snap a photo, speak or type a description, and drop a pin on the map. All three are optional inputs — use whichever is easiest right now.',
  },
  {
    icon: Bot,
    title: 'Five AI agents take over',
    body: 'CivicEye classifies the photo, duplicate reports within 75 m merge into one master ticket, and Smart Triage routes it to the right department with an SLA clock already running.',
  },
  {
    icon: CheckCheck,
    title: 'Verified fixes only',
    body: 'A ticket can’t close on a promise. The CoV must upload an "after" photo, our CivicProof agent checks it against the original, and then you get the final say.',
  },
];

export default function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const t = useTranslate();
  const [stepIndex, setStepIndex] = useState(0);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [location, setLocation] = useState<GeoPoint | null>(null);

  if (!open) return null;

  const step = STEPS[stepIndex];
  const goNext = () => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
  const goBack = () => setStepIndex((index) => Math.max(0, index - 1));
  const finish = () => onComplete({ locationGranted: locationStatus === 'granted', location });

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        });
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="modal-backdrop z-[2000]">
      <div role="dialog" aria-modal="true" aria-label={t('Welcome to Civicloop')} className="modal-panel max-w-md">
        <div
          className="flex items-center gap-1.5 px-6 pt-5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-label={t('Onboarding progress')}
        >
          {STEPS.map((s, index) => (
            <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span
                className={cn(
                  'block h-full rounded-full bg-emerald-600 transition-transform duration-300 ease-out',
                  index <= stepIndex ? 'translate-x-0' : '-translate-x-full',
                )}
              />
            </span>
          ))}
        </div>

        <div key={step} className="min-h-[17rem] animate-slide-up px-6 py-7">
          {step === 'privacy' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 ring-8 ring-emerald-50 dark:ring-[#16382d]/40">
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{t('Your privacy, protected by design')}</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                {t('Your phone number and identity are')} <span className="font-semibold text-slate-900">{t('never shown publicly')}</span>.{' '}
                {t('Only the issue category and its location are dispatched to the CoV responsible for fixing it — you appear to everyone else as an anonymous, pseudonymous citizen.')}
              </p>
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 ring-8 ring-blue-50 dark:ring-[#1d3044]/40">
                <MapPin className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{t('Help us pinpoint civic issues')}</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                {t('We use your location only to pre-fill the map pin when you file a report, so you don’t have to hunt for the exact spot. You can always drag the pin to correct it, and nothing is shared until you submit a report.')}
              </p>

              {locationStatus === 'granted' && (
                <p role="status" className="mx-auto flex w-fit animate-fade-in items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                  <CheckCheck className="h-4 w-4" /> {t('Location ready')}
                </p>
              )}
              {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
                <p role="status" className="mx-auto flex w-fit animate-fade-in items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {locationStatus === 'unsupported'
                    ? t('Your browser doesn’t support location — you can place the pin manually.')
                    : t('Permission denied — you can place the pin manually when you report.')}
                </p>
              )}

              {locationStatus !== 'granted' && (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === 'requesting'}
                  className="btn btn-primary mx-auto"
                >
                  {locationStatus === 'requesting' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {t('Allow location access')}
                </button>
              )}
            </div>
          )}

          {(step === 'tour-1' || step === 'tour-2' || step === 'tour-3') &&
            (() => {
              const card = TOUR_CARDS[stepIndex - 2];
              return (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 ring-8 ring-violet-50 dark:ring-[#302545]/40">
                    <card.icon className="h-7 w-7 text-violet-600" />
                  </div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-violet-600">
                    {t('Quick tour')} · {t('Step')} {stepIndex - 1} {t('of')} 3
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{t(card.title)}</h2>
                  <p className="text-sm leading-relaxed text-slate-600">{t(card.body)}</p>
                </div>
              );
            })()}
        </div>

        <div className="modal-footer justify-start px-6 py-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="btn btn-ghost px-3"
            >
              <ChevronLeft className="h-4 w-4" /> {t('Back')}
            </button>
          ) : (
            <span />
          )}

          <div className="ml-auto flex gap-2">
            {step === 'location' && locationStatus !== 'granted' && (
              <button type="button" onClick={goNext} className="btn btn-ghost">
                {t('Skip for now')}
              </button>
            )}
            <button
              type="button"
              onClick={stepIndex === STEPS.length - 1 ? finish : goNext}
              className="btn btn-primary group px-5"
            >
              {t(stepIndex === STEPS.length - 1 ? 'Get started' : 'Continue')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
