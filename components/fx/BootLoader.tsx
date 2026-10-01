'use client';

import { useEffect, useRef } from 'react';
import { BOOT_EVENT, isBooting } from '@/lib/fx';

const DURATION_MS = 2100;
const STAGES = [
  'Initializing interface',
  'Linking 5 civic agents',
  'Calibrating 75 m geo-mesh',
  'Syncing SLA sentinel',
  'Loop online',
];
const BAR_CELLS = 24;

/**
 * First-load "booting" sequence. The markup is always server-rendered but only visible while
 * <html data-boot> is set (by BOOT_SCRIPT), so returning visitors never see a flash of it.
 * While it runs, CSS holds the page's own entrance animations at their first frame; clearing
 * the attribute releases them, so the dashboard assembles itself right after the overlay.
 */
export default function BootLoader() {
  const percentRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBooting()) return;
    const root = document.documentElement;
    const start = performance.now();
    let frame = 0;
    let finishTimer = 0;

    const release = () => {
      if (!root.hasAttribute('data-boot')) return;
      try {
        sessionStorage.setItem('civicloop.booted', '1');
      } catch {
        // Storage blocked: the boot sequence simply plays again next load.
      }
      root.removeAttribute('data-boot');
      window.dispatchEvent(new Event(BOOT_EVENT));
    };
    // Failsafe: the overlay locks scrolling, so it must never outlive a stalled animation loop.
    const failsafe = window.setTimeout(release, DURATION_MS + 2500);

    const tick = (now: number) => {
      // rAF timestamps can predate `start` by a frame, so clamp both ends.
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      // Stutters a little like a real loader: fast, a pause, then a sprint to 100.
      const eased = t < 0.55 ? (t / 0.55) * 0.62 : t < 0.7 ? 0.62 + ((t - 0.55) / 0.15) * 0.06 : 0.68 + ((t - 0.7) / 0.3) * 0.32;
      const percent = Math.round(eased * 100);
      if (percentRef.current) percentRef.current.textContent = String(percent).padStart(2, '0');
      if (barRef.current) {
        const filled = Math.min(BAR_CELLS, Math.max(0, Math.round(eased * BAR_CELLS)));
        barRef.current.textContent = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled);
      }
      if (stageRef.current) stageRef.current.textContent = STAGES[Math.min(STAGES.length - 1, Math.floor(eased * STAGES.length))];
      if (t < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      hostRef.current?.classList.add('is-done');
      finishTimer = window.setTimeout(release, 650);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(finishTimer);
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div ref={hostRef} className="fx-boot" aria-hidden="true">
      <div className="fx-boot-grid" />
      <div className="fx-boot-scan" />
      <div className="fx-boot-core">
        <div className="fx-boot-rings">
          <svg viewBox="0 0 200 200" className="fx-boot-ring fx-boot-ring-a">
            <circle cx="100" cy="100" r="92" fill="none" strokeWidth="1.5" strokeDasharray="4 10" />
          </svg>
          <svg viewBox="0 0 200 200" className="fx-boot-ring fx-boot-ring-b">
            <circle cx="100" cy="100" r="78" fill="none" strokeWidth="2.5" strokeDasharray="120 370" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 200 200" className="fx-boot-ring fx-boot-ring-c">
            <circle cx="100" cy="100" r="64" fill="none" strokeWidth="1" strokeDasharray="2 6" />
          </svg>
          <div className="fx-boot-logo" data-text="civicloop">
            civic<span>loop</span>
          </div>
        </div>
        <div className="fx-boot-readout">
          <span ref={stageRef} className="fx-boot-stage">
            {STAGES[0]}
          </span>
          <span className="fx-boot-percent">
            <span ref={percentRef}>00</span>%
          </span>
        </div>
        <span ref={barRef} className="fx-boot-bar">
          {'░'.repeat(BAR_CELLS)}
        </span>
        <div className="fx-boot-coords">
          <span>LAT 17.2844°N</span>
          <span>LNG 78.5651°E</span>
          <span>NODE GHMC-SE</span>
        </div>
      </div>
    </div>
  );
}
