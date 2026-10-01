import { cn } from '@/lib/cn';

interface HudFrameProps {
  /** Top-left readout, e.g. a section code. */
  label?: string;
  /** Bottom-right readout, e.g. coordinates. */
  readout?: string;
  /** Draw the slow vertical scan line. */
  scan?: boolean;
  className?: string;
}

/**
 * Game-HUD decoration laid over a section: corner brackets, tiny readouts, tick rulers,
 * a rotating mini ring and an optional scan line. Purely decorative and pointer-transparent;
 * the parent must be `position: relative`.
 */
export default function HudFrame({ label, readout, scan = false, className }: HudFrameProps) {
  return (
    <div className={cn('fx-hud', className)} aria-hidden="true">
      <span className="fx-hud-corner fx-hud-tl" />
      <span className="fx-hud-corner fx-hud-tr" />
      <span className="fx-hud-corner fx-hud-bl" />
      <span className="fx-hud-corner fx-hud-br" />
      {label && <span className="fx-hud-label fx-hud-label-tl">{label}</span>}
      {readout && <span className="fx-hud-label fx-hud-label-br">{readout}</span>}
      <span className="fx-hud-ticks fx-hud-ticks-top" />
      <span className="fx-hud-ticks fx-hud-ticks-side" />
      <svg className="fx-hud-ring" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" fill="none" strokeWidth="1" strokeDasharray="3 5" />
        <circle cx="20" cy="20" r="11" fill="none" strokeWidth="1.5" strokeDasharray="18 52" />
        <circle cx="20" cy="20" r="2" />
      </svg>
      {scan && <span className="fx-hud-scan" />}
    </div>
  );
}
