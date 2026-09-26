'use client';

import type { ReactNode } from 'react';
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface GlideTab<T extends string> {
  id: T;
  label: ReactNode;
  icon?: LucideIcon;
}

interface GlideTabsProps<T extends string> {
  items: readonly GlideTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  compact?: boolean;
}

export default function GlideTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  compact = false,
}: GlideTabsProps<T>) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'glide-tabs grid rounded-xl bg-slate-100/80 p-1',
        compact ? 'text-[10px] font-semibold sm:text-xs' : 'text-xs font-semibold sm:text-sm',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const selected = value === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={selected}
            className={cn(
              'relative isolate flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center leading-tight transition-colors sm:px-3',
              selected ? 'text-emerald-950' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 480, damping: 38, mass: 0.8 }
                }
              />
            )}
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
            <span className="min-w-0">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
