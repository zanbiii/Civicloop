'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  LoaderCircle,
  MapPin,
  Mic,
  PartyPopper,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  CATEGORY_META,
  COMPLAINT_CATEGORIES,
  type ComplaintCategory,
  type EvidencePhoto,
  type GeoPoint,
  type IntakeDraft,
  type InputMode,
  type PublicReporter,
} from '@/types/civic';
import { resolveWardZone } from '@/lib/haversine';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import CameraCapture from '@/components/CameraCapture';
import VoiceInput from '@/components/VoiceInput';
import LeafletMap from '@/components/LeafletMap';
import { cn } from '@/lib/cn';

export type IntakeLanguage = IntakeDraft['language'];

interface CitizenIntakeFormProps {
  reporter: PublicReporter;
  language: IntakeLanguage;
  initialLocation?: GeoPoint | null;
  onSubmit: (draft: IntakeDraft) => Promise<{ success: boolean; message?: string }>;
  onCancel?: () => void;
}

type Step = 'evidence' | 'describe' | 'location' | 'review';
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'describe', label: 'Describe' },
  { id: 'location', label: 'Location' },
  { id: 'review', label: 'Review' },
];

function finalizeLocation(point: GeoPoint): GeoPoint {
  if (point.ward && point.zone) return point;
  const resolved = resolveWardZone(point);
  return resolved ? { ...point, ward: point.ward ?? resolved.ward, zone: point.zone ?? resolved.zone } : point;
}

export default function CitizenIntakeForm({ reporter, language, initialLocation = null, onSubmit, onCancel }: CitizenIntakeFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [description, setDescription] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoPoint | null>(initialLocation);
  const [landmark, setLandmark] = useState('');
  const [categoryOverride, setCategoryOverride] = useState<ComplaintCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const step = STEPS[stepIndex].id;
  const hasDescription = description.trim().length > 0 || Boolean(voiceTranscript?.trim());
  const resolvedWard = useMemo(() => (location ? resolveWardZone(location) : null), [location]);

  const canAdvance = step === 'evidence' || (step === 'describe' && hasDescription) || (step === 'location' && Boolean(location));

  const goNext = () => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
  const goBack = () => setStepIndex((index) => Math.max(0, index - 1));

  const resetForm = () => {
    setStepIndex(0);
    setPhotos([]);
    setDescription('');
    setVoiceTranscript(null);
    setLocation(initialLocation);
    setLandmark('');
    setCategoryOverride(null);
    setSubmitError(null);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);
    setSubmitError(null);

    const inputModes: InputMode[] = [
      ...(photos.length > 0 ? (['photo'] as const) : []),
      ...(voiceTranscript?.trim() ? (['voice'] as const) : []),
      ...(description.trim() ? (['text'] as const) : []),
      'map-pin',
    ];

    const finalLocation = finalizeLocation(landmark.trim() ? { ...location, address: landmark.trim() } : location);

    const draft: IntakeDraft = {
      description: description.trim(),
      photos,
      location: finalLocation,
      voiceTranscript: voiceTranscript?.trim() || null,
      inputModes,
      language,
      reporter,
      categoryOverride,
    };

    try {
      const result = await onSubmit(draft);
      if (result.success) {
        setSubmitted(true);
      } else {
        setSubmitError(result.message ?? 'Something went wrong submitting your report. Please try again.');
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong submitting your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
          <PartyPopper className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Report submitted</h3>
        <p className="max-w-sm text-sm text-slate-600">
          Civicloop&apos;s agents are already classifying it, checking for duplicates within 75 m, and routing it to the right
          department. You can track its status from &quot;My Reports&quot;.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Report another issue
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {STEPS.map((s, index) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                index < stepIndex
                  ? 'bg-emerald-600 text-white'
                  : index === stepIndex
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400',
              )}
            >
              {index < stepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <span className={cn('hidden text-xs font-medium sm:inline', index === stepIndex ? 'text-slate-900' : 'text-slate-400')}>
              {s.label}
            </span>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 'evidence' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Camera className="h-4 w-4" /> Add a photo (optional, but it helps a lot)
          </div>
          <CameraCapture photos={photos} onPhotosChange={setPhotos} kind="before" capturedBy={reporter.displayName} geo={location} />
        </div>
      )}

      {step === 'describe' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Mic className="h-4 w-4" /> What&apos;s the problem?
          </div>
          <VoiceInput
            value={description}
            onChange={setDescription}
            onVoiceTranscript={setVoiceTranscript}
            language={language}
            placeholder="e.g. Big pothole near the bus stop, bikes keep skidding..."
          />
          {!hasDescription && <p className="text-xs text-slate-400">Type a short description or tap the mic to speak it.</p>}
        </div>
      )}

      {step === 'location' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MapPin className="h-4 w-4" /> Where exactly is this?
          </div>
          <LeafletMap
            pickedLocation={location}
            onPickLocation={setLocation}
            userLocation={initialLocation}
            containerClassName="h-72"
            zoom={location ? 16 : 13}
          />
          <p className="text-xs text-slate-500">Tap the map or drag the pin to the exact spot. {resolvedWard ? `Ward: ${resolvedWard.ward}.` : ''}</p>
          <input
            value={landmark}
            onChange={(event) => setLandmark(event.target.value)}
            placeholder="Landmark or address note (optional) — e.g. near Sony World Signal"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
      )}

      {step === 'review' && location && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Category</span>
              {categoryOverride === null && (
                <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  <Sparkles className="h-3 w-3" /> CivicEye decides
                </span>
              )}
            </div>
            <select
              value={categoryOverride ?? ''}
              onChange={(event) => setCategoryOverride(event.target.value ? (event.target.value as ComplaintCategory) : null)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="">Let AI classify from the photo/description</option>
              {COMPLAINT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_META[category].icon} {category}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="shrink-0 font-semibold text-slate-500">Description</span>
              <span className="text-right text-slate-800">{description.trim() || <span className="italic text-slate-400">None — voice/photo only</span>}</span>
            </div>
            {voiceTranscript && (
              <div className="flex justify-between gap-3">
                <span className="shrink-0 font-semibold text-slate-500">Voice note</span>
                <span className="text-right italic text-slate-600">&quot;{voiceTranscript}&quot;</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="shrink-0 font-semibold text-slate-500">Location</span>
              <span className="text-right text-slate-800">
                {landmark || location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                {resolvedWard ? ` · ${resolvedWard.ward}` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 font-semibold text-slate-500">Photos</span>
              <span className="text-slate-800">{photos.length} attached</span>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="flex gap-2">
              {photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- preview thumbnail may be a base64 data: URL
                <img
                  key={photo.id}
                  src={photo.url}
                  alt="Evidence"
                  className="h-16 w-16 rounded-lg object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              ))}
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {submitError}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
          )
        )}

        {step === 'review' ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="ml-auto flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Submit report
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
