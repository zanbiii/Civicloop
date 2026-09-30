'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  /** A number, or a string whose first number is animated (e.g. "45%"). */
  value: number | string;
  duration?: number;
}

/** Eases a KPI from its previous value to the new one whenever it changes. */
export default function CountUp({ value, duration = 1.1 }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const text = String(value);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  const target = match ? Number(match[0]) : null;
  const decimals = match?.[0].split('.')[1]?.length ?? 0;
  const prefix = match ? text.slice(0, match.index) : '';
  const suffix = match ? text.slice((match.index ?? 0) + match[0].length) : '';
  const [display, setDisplay] = useState(target ?? 0);
  const current = useRef(0);

  useEffect(() => {
    if (target === null) return;
    const controls = animate(current.current, target, {
      duration: reduceMotion ? 0 : duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        current.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
  }, [target, duration, reduceMotion]);

  if (target === null) return <>{text}</>;
  return (
    <span className="tabular-nums">
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
