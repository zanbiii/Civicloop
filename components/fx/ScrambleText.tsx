'use client';

import { useEffect, useState } from 'react';
import { afterBoot, prefersReducedMotion } from '@/lib/fx';

const GLYPHS = '!<>-_\\/[]{}=+*^?#%&@$ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
/** Only plain Latin text scrambles; Kannada/Devanagari would turn into broken clusters. */
const SCRAMBLABLE = /^[\x20-\x7E·—–’…]*$/;

interface ScrambleTextProps {
  text: string;
  className?: string;
  /** Extra wait before decoding starts, in ms. */
  delay?: number;
  /** Total decode time in ms. */
  duration?: number;
}

/** Decodes from random glyphs into `text` (A#@L%T!CS → ANALYTICS) on mount and on change. */
export default function ScrambleText({ text, className, delay = 0, duration = 900 }: ScrambleTextProps) {
  // The in-flight scrambled frame for `source`; anything else means "show the real text".
  const [frame, setFrame] = useState<{ source: string; value: string } | null>(null);
  const display = frame && frame.source === text ? frame.value : text;

  useEffect(() => {
    if (!SCRAMBLABLE.test(text) || prefersReducedMotion()) return;
    let interval = 0;
    let timeout = 0;
    const cancelBoot = afterBoot(() => {
      timeout = window.setTimeout(() => {
        const start = performance.now();
        interval = window.setInterval(() => {
          const progress = Math.min(1, (performance.now() - start) / duration);
          const revealed = Math.floor(progress * text.length);
          let next = '';
          for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            next += i < revealed || char === ' ' ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
          setFrame(progress >= 1 ? null : { source: text, value: next });
          if (progress >= 1) window.clearInterval(interval);
        }, 34);
      }, delay);
    });
    return () => {
      cancelBoot();
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [text, delay, duration]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
