'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, CircleCheck, ImagePlus, LoaderCircle, SwitchCamera, TriangleAlert, X } from 'lucide-react';
import type { EvidenceKind, EvidencePhoto, EvidenceSource, GeoPoint } from '@/types/civic';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import { cn } from '@/lib/cn';

interface CameraCaptureProps {
  photos: EvidencePhoto[];
  onPhotosChange: (photos: EvidencePhoto[]) => void;
  /** `before` for citizen intake, `after` for CivicProof closure evidence. */
  kind?: EvidenceKind;
  capturedBy: string;
  /** Device location at capture time, attached as the photo's geotag. */
  geo?: GeoPoint | null;
  maxPhotos?: number;
  label?: string;
  className?: string;
}

/** Longest edge after downscaling — keeps base64 payloads small enough for the vision model and storage. */
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.82;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const noopSubscribe = () => () => {};

function useCameraSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    () => false,
  );
}

// crypto.randomUUID is missing on plain-http LAN origins, which is exactly how phones hit the dev server.
function makeId(kind: EvidenceKind): string {
  return `photo-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function fileToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(drawToJpeg(image, image.naturalWidth, image.naturalHeight));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = objectUrl;
  });
}

/** Uploads to Cloudinary when an unsigned preset is configured; otherwise keeps the base64 data URL. */
async function persistImage(dataUrl: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) return dataUrl;
  try {
    const body = new FormData();
    body.append('file', dataUrl);
    body.append('upload_preset', CLOUDINARY_PRESET);
    body.append('folder', 'civicloop');
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST',
      body,
    });
    if (!response.ok) return dataUrl;
    const json = (await response.json()) as { secure_url?: string };
    return json.secure_url ?? dataUrl;
  } catch {
    return dataUrl;
  }
}

export default function CameraCapture({
  photos,
  onPhotosChange,
  kind = 'before',
  capturedBy,
  geo = null,
  maxPhotos = 3,
  label,
  className,
}: CameraCaptureProps) {
  const cameraSupported = useCameraSupported();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  const full = photos.length >= maxPhotos;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setError(null);
    if (!cameraSupported) {
      captureInputRef.current?.click();
      return;
    }
    setStarting(true);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. You can still upload a photo from your gallery.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No usable camera was found. Upload a photo instead.'
            : 'The camera could not be started. Upload a photo instead.',
      );
      stopCamera();
    } finally {
      setStarting(false);
    }
  };

  const addPhoto = async (dataUrl: string, source: EvidenceSource) => {
    const url = await persistImage(dataUrl);
    const photo: EvidencePhoto = {
      id: makeId(kind),
      kind,
      url,
      source,
      capturedAt: new Date().toISOString(),
      capturedBy,
      geo,
      caption: null,
    };
    onPhotosChange([...photos, photo].slice(0, maxPhotos));
  };

  const snap = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setProcessing(true);
    try {
      const dataUrl = drawToJpeg(video, video.videoWidth, video.videoHeight);
      stopCamera();
      await addPhoto(dataUrl, 'camera');
    } catch (snapError) {
      setError(snapError instanceof Error ? snapError.message : 'Could not capture the photo.');
    } finally {
      setProcessing(false);
    }
  };

  const handleFile = async (file: File | undefined, source: EvidenceSource) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is larger than 15 MB. Please choose a smaller one.');
      return;
    }
    setProcessing(true);
    try {
      await addPhoto(await fileToJpeg(file), source);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Could not read that image.');
    } finally {
      setProcessing(false);
    }
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void startCamera(next);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className="text-xs text-slate-500">
            {photos.length}/{maxPhotos}
          </span>
        </div>
      )}

      <div className={cn('relative overflow-hidden rounded-xl bg-slate-900', live ? 'block' : 'hidden')}>
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3">
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 active:scale-90"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={snap}
            disabled={processing}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/30 shadow-lg transition hover:scale-105 hover:bg-white/50 active:scale-90 disabled:opacity-60"
            aria-label="Take photo"
          />
          <button
            type="button"
            onClick={switchCamera}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60 active:scale-90"
            aria-label="Switch camera"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!live && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={full || starting || processing}
            aria-busy={starting}
            className="btn btn-primary btn-lg"
          >
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Snap photo
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={full || processing}
            className="btn btn-secondary btn-lg"
          >
            <ImagePlus className="h-4 w-4" />
            Upload
          </button>
        </div>
      )}

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0], 'camera');
          event.target.value = '';
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0], 'upload');
          event.target.value = '';
        }}
      />

      {processing && (
        <div role="status" className="flex items-center gap-2 text-xs text-slate-500">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Processing photo…
        </div>
      )}

      {error && (
        <div role="alert" className="flex animate-slide-down items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {(photos.length > 0 || processing) && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square animate-scale-in overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- previews are base64 data: URLs */}
              <img
                src={photo.url}
                alt={`${photo.kind} evidence`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(event) => {
                  event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
              />
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                <CircleCheck className="h-2.5 w-2.5" />
                {photo.source === 'camera' ? 'Camera' : 'Upload'}
                {photo.geo ? ' · Geotagged' : ''}
              </span>
              <button
                type="button"
                onClick={() => onPhotosChange(photos.filter((existing) => existing.id !== photo.id))}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-600 active:scale-90"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {processing && <div className="skeleton aspect-square rounded-xl" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
