'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PLACEHOLDER_IMAGE } from '@/lib/seedData';
import { cn } from '@/lib/cn';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

function fallbackOnError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.src = PLACEHOLDER_IMAGE;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-video w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl bg-slate-900', className)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) updateFromClientX(event.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
      <img src={afterUrl} alt={afterLabel} draggable={false} onError={fallbackOnError} className="absolute inset-0 h-full w-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element -- evidence may be a base64 data: URL */}
      <img
        src={beforeUrl}
        alt={beforeLabel}
        draggable={false}
        onError={fallbackOnError}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
        {afterLabel}
      </span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" style={{ left: `${position}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-slate-900/80 text-white shadow-lg">
          <ChevronLeft className="-mr-1 h-3.5 w-3.5" />
          <ChevronRight className="-ml-1 h-3.5 w-3.5" />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(position)}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Compare before and after photos"
        className="peer sr-only"
      />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-transparent peer-focus-visible:ring-blue-500" />
    </div>
  );
}
