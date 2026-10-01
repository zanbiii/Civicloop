'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Repeat2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';
import CountUp from '@/components/CountUp';
import { LiveIndicator } from '@/components/fx/Indicators';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Small count shown at the right of the label. */
  badge?: number | string;
  /** In-page anchor; when set the item scrolls instead of calling `onSelect`. */
  href?: string;
  onSelect?: () => void;
}

interface SidebarProps {
  items: readonly SidebarItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  /** Heading above the items, e.g. the signed-in role. */
  sectionLabel: string;
  /** Live city pulse shown at the bottom of the rail. */
  pulse: { label: string; value: number | string; sub: string };
}

/** Left rail on desktop, floating bottom bar on phones. */
export default function Sidebar({ items, activeId, onNavigate, sectionLabel, pulse }: SidebarProps) {
  const t = useTranslate();
  const layoutId = useId();
  const reduceMotion = useReducedMotion();

  const renderItem = (item: SidebarItem, compact: boolean) => {
    const active = item.id === activeId;
    const Icon = item.icon;
    const content = (
      <>
        {active && (
          <motion.span
            layoutId={`${layoutId}-${compact ? 'm' : 'd'}`}
            aria-hidden="true"
            className="side-nav-active absolute inset-0 rounded-xl"
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          />
        )}
        <Icon className={cn('relative shrink-0', compact ? 'h-5 w-5' : 'h-[18px] w-[18px]')} aria-hidden="true" />
        <span className={cn('relative truncate', compact ? 'text-[10px]' : 'text-[13px]')}>{t(item.label)}</span>
        {!compact && item.badge !== undefined && (
          <span className="relative ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{item.badge}</span>
        )}
      </>
    );
    const className = cn(
      'side-nav-item group relative flex items-center rounded-xl font-semibold transition-colors duration-200',
      compact ? 'min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5' : 'gap-3 px-3 py-2.5',
      active && 'is-active',
    );
    const shared = {
      className,
      'aria-current': active ? ('page' as const) : undefined,
      onClick: () => {
        onNavigate(item.id);
        item.onSelect?.();
      },
    };
    return item.href ? (
      <a key={item.id} href={item.href} {...shared}>
        {content}
      </a>
    ) : (
      <button key={item.id} type="button" {...shared}>
        {content}
      </button>
    );
  };

  return (
    <>
      <aside className="side-rail fixed inset-y-0 left-0 z-40 hidden w-72 flex-col gap-6 p-4 lg:flex" aria-label={t('Main navigation')}>
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="side-logo flex h-11 w-11 items-center justify-center rounded-2xl text-white">
            <Repeat2 className="h-5 w-5" strokeWidth={2.3} aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              civic<span className="side-wordmark">loop</span>
            </div>
            <div className="text-[10px] font-medium tracking-wide text-slate-500">{t('A better loop for city fixes')}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label={sectionLabel}>
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t(sectionLabel)}</div>
          {items.map((item) => renderItem(item, false))}
        </nav>

        <div className="side-pulse tilt fx-border relative mt-auto overflow-hidden rounded-2xl p-4">
          <span className="fx-scanline" aria-hidden="true" />
          <LiveIndicator label={t(pulse.label)} />
          <div className="fx-z2 mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-900">
            <CountUp value={pulse.value} />
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{t(pulse.sub)}</div>
          <svg viewBox="0 0 120 32" className="mt-3 h-8 w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="fx-spark-gradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="55%" stopColor="#39e6ff" />
                <stop offset="100%" stopColor="#ff3dcb" />
              </linearGradient>
            </defs>
            <path id="fx-spark-path" className="side-spark" d="M0 24 C12 22 16 10 28 14 S46 28 58 18 S78 4 90 12 S108 20 120 6" fill="none" strokeWidth="2" strokeLinecap="round" />
            {!reduceMotion && (
              <circle r="2.6" className="fill-[var(--signal)] [filter:drop-shadow(0_0_4px_var(--signal))]">
                <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#fx-spark-path" />
                </animateMotion>
              </circle>
            )}
          </svg>
        </div>
      </aside>

      <nav
        className="side-dock fixed inset-x-3 bottom-3 z-40 flex items-stretch gap-1 rounded-2xl p-1.5 lg:hidden"
        aria-label={t('Main navigation')}
      >
        {items.map((item) => renderItem(item, true))}
      </nav>
    </>
  );
}
