'use client';

import { useEffect, useRef } from 'react';
import { pointer, richPointerEffects } from '@/lib/fx';

type CursorState = 'default' | 'link' | 'cta' | 'card' | 'label' | 'text' | 'hidden';

/**
 * Resolves what the cursor should look like over `el`. An explicit `data-cursor="LABEL"` on
 * any ancestor wins, so components can opt into a label ("VIEW", "DRAG", "OPEN") without
 * touching this file.
 */
function resolve(el: Element | null): { state: CursorState; label: string } {
  if (!el) return { state: 'default', label: '' };
  const labelled = el.closest<HTMLElement>('[data-cursor]');
  if (labelled?.dataset.cursor) return { state: 'label', label: labelled.dataset.cursor };
  if (el.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]')) {
    return { state: 'text', label: '' };
  }
  if (el.closest('.leaflet-marker-icon, .leaflet-interactive')) return { state: 'link', label: '' };
  if (el.closest('.leaflet-container')) return { state: 'label', label: 'DRAG' };
  if (el.closest('.btn-primary, [data-cursor-cta]')) return { state: 'cta', label: '' };
  if (el.closest('a[href], button:not(:disabled), [role="button"], [role="menuitemradio"], label[for], summary, input[type="checkbox"], input[type="radio"]')) {
    return { state: 'link', label: '' };
  }
  if (el.closest('img')) return { state: 'label', label: 'VIEW' };
  if (el.closest('.surface-card, .tilt')) return { state: 'card', label: '' };
  return { state: 'default', label: '' };
}

/**
 * Dot + lagging ring with velocity stretch, per-element states, hover labels and click
 * ripples. Only mounts its behaviour for a real mouse with motion allowed; otherwise the
 * native cursor is left alone.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const rippleHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!richPointerEffects()) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    const host = rippleHost.current;
    if (!dot || !ring || !label || !host) return;

    const root = document.documentElement;
    root.classList.add('fx-cursor');

    let rx = pointer.x;
    let ry = pointer.y;
    let dx = pointer.x;
    let dy = pointer.y;
    let state: CursorState = 'default';
    let frame = 0;

    const setState = (next: { state: CursorState; label: string }) => {
      if (next.state !== state) {
        state = next.state;
        ring.dataset.state = state;
        dot.dataset.state = state;
      }
      if (label.textContent !== next.label) label.textContent = next.label;
    };

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const visible = pointer.inside;
      ring.style.opacity = visible ? '' : '0';
      dot.style.opacity = visible ? '' : '0';
      if (!visible) return;

      dx += (pointer.x - dx) * 0.55;
      dy += (pointer.y - dy) * 0.55;
      rx += (pointer.x - rx) * 0.16;
      ry += (pointer.y - ry) * 0.16;

      const speed = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 40);
      const angle = Math.atan2(pointer.vy, pointer.vx) * (180 / Math.PI);
      const stretch = state === 'default' || state === 'card' ? speed * 0.45 : speed * 0.15;
      pointer.vx *= 0.9;
      pointer.vy *= 0.9;

      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      ring.style.transform =
        `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${1 + stretch}, ${1 - stretch * 0.6})`;
      // Counter-rotate the label so text stays upright while the ring stretches.
      label.style.transform = `rotate(${-angle}deg)`;
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setState(resolve(event.target as Element | null));
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      ring.classList.add('is-down');
      const ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      host.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    };
    const onUp = () => ring.classList.remove('is-down');

    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      root.classList.remove('fx-cursor');
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <div className="fx-cursor-layer" aria-hidden="true">
      <div ref={rippleHost} />
      <div ref={ringRef} className="fx-cursor-ring" data-state="default">
        <span ref={labelRef} className="fx-cursor-label" />
      </div>
      <div ref={dotRef} className="fx-cursor-dot" data-state="default" />
    </div>
  );
}
