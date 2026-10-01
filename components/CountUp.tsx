'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { afterBoot } from '@/lib/fx';

interface CountUpProps {
  /** A number, or a string whose first number is animated (e.g. "45%", "₹1,200"). */
  value: number | string;
  /** Roll duration per digit column, in seconds. */
  duration?: number;
}

const DIGITS = '0123456789';

/**
 * Odometer-style KPI: every digit is a 0–9 column that rolls to its place. On mount the
 * columns spin up from zero (after the boot overlay clears); on change the old value rolls
 * into the new one. Pure CSS transforms, so there are no per-frame React renders.
 */
export default function CountUp({ value, duration = 1.1 }: CountUpProps) {
  const text = String(value);
  // Columns start at zero and roll up once mounted (and the boot overlay is gone); screen
  // readers always get the real value from the sr-only copy.
  const [primed, setPrimed] = useState(false);

  useEffect(() => {
    let frame = 0;
    const cancel = afterBoot(() => {
      frame = window.requestAnimationFrame(() => setPrimed(true));
    });
    return () => {
      cancel();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const chars = Array.from(text);
  const digitCount = chars.filter((char) => DIGITS.includes(char)).length;
  let digitIndex = 0;

  return (
    <span className="fx-odometer">
      <span className="sr-only">{text}</span>
      {chars.map((char, index) => {
        // Key from the right so the ones column keeps its identity when the number grows.
        const key = chars.length - index;
        if (!DIGITS.includes(char)) {
          return (
            <span key={`s${key}`} className="fx-odometer-sym" aria-hidden="true">
              {char}
            </span>
          );
        }
        const position = digitIndex;
        digitIndex += 1;
        const shown = primed ? Number(char) : 0;
        return (
          <span key={`d${key}`} className="fx-odometer-digit" aria-hidden="true">
            <span
              className="fx-odometer-strip"
              style={
                {
                  transform: `translateY(${-shown * 10}%)`,
                  transitionDuration: `${duration + (digitCount - position) * 0.12}s`,
                } as CSSProperties
              }
            >
              {DIGITS.split('').map((digit) => (
                <span key={digit}>{digit}</span>
              ))}
            </span>
            {/* Invisible copy sizes the column to the real glyph width. */}
            <span className="fx-odometer-sizer">{char}</span>
          </span>
        );
      })}
    </span>
  );
}
