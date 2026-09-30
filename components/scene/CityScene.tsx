'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useAppTheme } from '@/components/AppThemeProvider';
import type { SceneVariant } from './CityCanvas';

const CityCanvas = dynamic(() => import('./CityCanvas'), { ssr: false });

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Civicloop: 3D scene unavailable, showing the static backdrop', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 3D city, loop ring and report pins. Pauses when off-screen and degrades to a flat backdrop without WebGL. */
export default function CityScene({ variant = 'hero', className }: { variant?: SceneVariant; className?: string }) {
  const { theme } = useAppTheme();
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0 });
    observer.observe(node);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', sync);
    };
  }, []);

  return (
    <div ref={host} className={className} aria-hidden="true">
      <SceneBoundary fallback={<div className="h-full w-full" />}>
        <CityCanvas variant={variant} dark={theme === 'dark'} active={active} reduce={reduce} />
      </SceneBoundary>
    </div>
  );
}
