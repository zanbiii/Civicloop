'use client';

import { useEffect } from 'react';

const MAX_TILT_DEG = 9;

/**
 * Pointer-driven 3D tilt + glare for any element with the `.tilt` class.
 * One delegated listener, so cards rendered later are picked up for free.
 */
export default function TiltEffect() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    let active: HTMLElement | null = null;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };

    const onMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('.tilt') ?? null;
      if (active && active !== target) reset(active);
      active = target;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      target.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      target.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      target.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      target.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    const onLeave = () => {
      if (active) reset(active);
      active = null;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return null;
}
