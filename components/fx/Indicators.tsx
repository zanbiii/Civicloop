import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** ● LIVE with a breathing dot and an expanding ring. `tone` picks the neon colour. */
export function LiveIndicator({
  label = 'Live',
  tone = 'emerald',
  className,
}: {
  label?: ReactNode;
  tone?: 'emerald' | 'cyan' | 'magenta' | 'amber';
  className?: string;
}) {
  return (
    <span className={cn('fx-live', `fx-live-${tone}`, className)}>
      <span className="fx-live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Decorative audio-style equaliser for "AI is working" states. */
export function Equalizer({ bars = 5, className }: { bars?: number; className?: string }) {
  return (
    <span className={cn('fx-eq', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}

/** Chromatic-split label that glitches briefly every few seconds. For short labels only. */
export function GlitchText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('fx-glitch', className)} data-text={text}>
      {text}
    </span>
  );
}

/** Shimmering pill badge: NEW / LIVE / AI / BETA. */
export function FxBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('fx-badge', className)}>{children}</span>;
}
