'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { LeafletMapProps } from './map/LeafletMapInner';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';

function MapLoading() {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
      <MapPin className="h-8 w-8 animate-bounce" />
      <span className="text-xs font-medium">{t('Loading OpenStreetMap…')}</span>
    </div>
  );
}

// Leaflet reads `window` at import time, so it is only ever loaded in the browser.
const LeafletMapInner = dynamic(() => import('./map/LeafletMapInner'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export type { LeafletMapProps };

interface LeafletMapWrapperProps extends LeafletMapProps {
  /** Sizing classes for the map frame; defaults to a 420px-tall block. */
  containerClassName?: string;
}

export default function LeafletMap({ containerClassName, ...props }: LeafletMapWrapperProps) {
  return (
    // `isolate` keeps Leaflet's internal z-index stack (panes up to 1000) from covering modals and the header.
    <div className={cn('relative isolate h-[420px] w-full overflow-hidden rounded-xl', containerClassName)}>
      <LeafletMapInner {...props} />
    </div>
  );
}
