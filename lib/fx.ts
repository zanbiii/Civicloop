/**
 * Shared, render-free state for the interface effects layer.
 *
 * Pointer position lives in a plain mutable object rather than React state: the cursor,
 * particle field and pointer effects each read it from their own requestAnimationFrame
 * loop, so mouse movement never triggers a React render.
 */

export const pointer = {
  x: -9999,
  y: -9999,
  /** Smoothed velocity in px/frame, used for cursor stretch and particle trails. */
  vx: 0,
  vy: 0,
  /** True once the pointer has moved inside the window. */
  inside: false,
};

export interface Burst {
  x: number;
  y: number;
  /** 1 for an ordinary click, ~2.5 for a primary call to action. */
  power: number;
}

const burstListeners = new Set<(burst: Burst) => void>();

export function emitBurst(burst: Burst): void {
  burstListeners.forEach((listener) => listener(burst));
}

export function onBurst(listener: (burst: Burst) => void): () => void {
  burstListeners.add(listener);
  return () => {
    burstListeners.delete(listener);
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Cursor, magnetism and tilt need a real mouse; touch and pen get the plain UI. */
export function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function richPointerEffects(): boolean {
  return hasFinePointer() && !prefersReducedMotion();
}

/* Boot sequence ------------------------------------------------------------- */

export const BOOT_EVENT = 'civicloop:booted';

/** Inline <head> script: arms the boot overlay before first paint, once per tab session. */
export const BOOT_SCRIPT =
  "try{if(!sessionStorage.getItem('civicloop.booted')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.setAttribute('data-boot','')}}catch(e){}";

/** True while the first-load "initializing" overlay is still on screen. */
export function isBooting(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-boot');
}

/** Runs `callback` once the boot overlay has cleared (immediately if there is none). */
export function afterBoot(callback: () => void): () => void {
  if (!isBooting()) {
    callback();
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(BOOT_EVENT, handler, { once: true });
  return () => window.removeEventListener(BOOT_EVENT, handler);
}
