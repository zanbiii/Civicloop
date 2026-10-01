'use client';

import { useEffect } from 'react';
import { emitBurst, pointer, prefersReducedMotion, richPointerEffects } from '@/lib/fx';

const MAX_TILT_DEG = 9;
/** Fraction of the pointer's offset from centre that a magnetic element follows. */
const MAGNET_PULL = 0.28;
const MAGNET_MAX_PX = 10;

const SPOT_SELECTOR = '.surface-card, .fx-spot, .modal-panel, .btn, .side-nav-item';
const MAGNET_SELECTOR = '.btn-primary, .btn-neutral, .magnetic, [data-magnetic]';
const BURST_SELECTOR = '.btn-primary, .btn-neutral, [data-burst]';

/**
 * One delegated pointer pipeline for every element-level effect, so cards and buttons
 * rendered later are picked up for free and nothing re-renders on mousemove:
 *
 * - `--cx/--cy` (px) and `--px/--py` (-1..1) on <html> for the cursor glow and parallax layers
 * - `--sx/--sy` on the hovered card/button for the spotlight and border light
 * - `--rx/--ry` on the hovered `.tilt` element for the 3D tilt
 * - `--tx/--ty` on the hovered magnetic element, which drifts toward the cursor
 * - click bursts for the particle field, plus an energy pulse on primary buttons
 * - `data-scrolled` on <html> so the top bar can turn to glass
 */
export default function PointerFx() {
  useEffect(() => {
    const root = document.documentElement;
    const rich = richPointerEffects();

    let frame = 0;
    let lastX = 0;
    let lastY = 0;
    let latestTarget: Element | null = null;
    let spot: HTMLElement | null = null;
    let tilt: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;

    const clear = (el: HTMLElement | null, ...props: string[]) => {
      if (el) props.forEach((prop) => el.style.removeProperty(prop));
    };

    const apply = () => {
      frame = 0;
      const { x, y } = pointer;
      const w = window.innerWidth;
      const h = window.innerHeight;
      root.style.setProperty('--cx', `${x.toFixed(0)}px`);
      root.style.setProperty('--cy', `${y.toFixed(0)}px`);
      root.style.setProperty('--px', ((x / w) * 2 - 1).toFixed(3));
      root.style.setProperty('--py', ((y / h) * 2 - 1).toFixed(3));

      const target = latestTarget;

      const nextSpot = target?.closest<HTMLElement>(SPOT_SELECTOR) ?? null;
      if (spot && spot !== nextSpot) clear(spot, '--sx', '--sy');
      spot = nextSpot;
      if (spot) {
        const rect = spot.getBoundingClientRect();
        spot.style.setProperty('--sx', `${(x - rect.left).toFixed(0)}px`);
        spot.style.setProperty('--sy', `${(y - rect.top).toFixed(0)}px`);
      }

      if (!rich) return;

      const nextTilt = target?.closest<HTMLElement>('.tilt') ?? null;
      if (tilt && tilt !== nextTilt) clear(tilt, '--rx', '--ry');
      tilt = nextTilt;
      if (tilt) {
        const rect = tilt.getBoundingClientRect();
        const nx = (x - rect.left) / rect.width;
        const ny = (y - rect.top) / rect.height;
        tilt.style.setProperty('--ry', `${((nx - 0.5) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${((0.5 - ny) * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      }

      const nextMagnet = target?.closest<HTMLElement>(MAGNET_SELECTOR) ?? null;
      if (magnet && magnet !== nextMagnet) clear(magnet, '--tx', '--ty');
      magnet = nextMagnet && !(nextMagnet as HTMLButtonElement).disabled ? nextMagnet : null;
      if (magnet) {
        const rect = magnet.getBoundingClientRect();
        // Measure from the untranslated centre so the pull doesn't feed back on itself.
        const tx = parseFloat(magnet.style.getPropertyValue('--tx')) || 0;
        const ty = parseFloat(magnet.style.getPropertyValue('--ty')) || 0;
        const dx = x - (rect.left - tx + rect.width / 2);
        const dy = y - (rect.top - ty + rect.height / 2);
        const clamp = (value: number) => Math.max(-MAGNET_MAX_PX, Math.min(MAGNET_MAX_PX, value * MAGNET_PULL));
        magnet.style.setProperty('--tx', `${clamp(dx).toFixed(1)}px`);
        magnet.style.setProperty('--ty', `${clamp(dy).toFixed(1)}px`);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      if (!pointer.inside) {
        lastX = event.clientX;
        lastY = event.clientY;
      }
      pointer.vx = pointer.vx * 0.6 + (event.clientX - lastX) * 0.4;
      pointer.vy = pointer.vy * 0.6 + (event.clientY - lastY) * 0.4;
      lastX = pointer.x = event.clientX;
      lastY = pointer.y = event.clientY;
      pointer.inside = true;
      latestTarget = event.target as Element | null;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pointer.inside = false;
      latestTarget = null;
      clear(spot, '--sx', '--sy');
      clear(tilt, '--rx', '--ry');
      clear(magnet, '--tx', '--ty');
      spot = tilt = magnet = null;
    };

    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const important = target?.closest<HTMLElement>(BURST_SELECTOR) ?? null;
      emitBurst({ x: event.clientX, y: event.clientY, power: important ? 2.6 : 1 });
      if (important && !prefersReducedMotion()) {
        // Web Animations, not a class toggle, so React's className stays the source of truth.
        important.animate(
          [
            { boxShadow: '0 0 0 0 rgb(57 230 255 / 0.65), 0 0 0 0 rgb(139 92 246 / 0.5)' },
            { boxShadow: '0 0 0 14px rgb(57 230 255 / 0), 0 0 40px 10px rgb(139 92 246 / 0)' },
          ],
          { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
      }
    };

    let scrolled = false;
    const onScroll = () => {
      const next = window.scrollY > 8;
      if (next === scrolled) return;
      scrolled = next;
      root.toggleAttribute('data-scrolled', next);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
