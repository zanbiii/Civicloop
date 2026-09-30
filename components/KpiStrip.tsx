'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Activity, CheckCircle2, Clock3, Layers, type LucideIcon } from 'lucide-react';
import type { BrainTelemetry } from '@/types/civic';
import { useTranslate } from '@/components/AppLanguageProvider';
import CountUp from '@/components/CountUp';

interface KpiCard {
  label: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  /** Tick colour for the filled part of the gauge. */
  tone: string;
  /** 0-1 fill for the gauge. */
  progress: number;
}

const TICKS = 24;

/** Survey-ruler gauges: a big display figure over a row of ticks that fill in sequence. */
export default function KpiStrip({ telemetry }: { telemetry: BrainTelemetry }) {
  const t = useTranslate();
  const reduceMotion = useReducedMotion();
  const slaTotal = telemetry.slaOnTrack + telemetry.slaWarning + telemetry.slaBreached + telemetry.slaMet;
  const onTimeShare = slaTotal > 0 ? (telemetry.slaOnTrack + telemetry.slaMet) / slaTotal : 1;
  const proofTotal = telemetry.proofVerified + telemetry.proofRejected;

  const cards: KpiCard[] = [
    { label: t('Total reports'), value: telemetry.totalReports, sub: `${telemetry.masterIssues} ${t('issues tracked')}`, icon: Layers, tone: 'var(--ink)', progress: telemetry.totalReports > 0 ? telemetry.masterIssues / telemetry.totalReports : 0 },
    { label: t('On-time rate'), value: `${Math.round(onTimeShare * 100)}%`, sub: `${telemetry.slaBreached} ${t('breached')}`, icon: Clock3, tone: 'var(--signal)', progress: onTimeShare },
    { label: t('Proof verified'), value: telemetry.proofVerified, sub: `${telemetry.proofRejected} ${t('proofs reviewed')}`, icon: CheckCircle2, tone: '#2f9a63', progress: proofTotal > 0 ? telemetry.proofVerified / proofTotal : 0 },
    { label: t('Routing accuracy'), value: `${Math.round(telemetry.routingAccuracyPercent)}%`, sub: `${telemetry.ticketsAutoCorrected} ${t('auto-corrected')}`, icon: Activity, tone: '#3f68e0', progress: telemetry.routingAccuracyPercent / 100 },
  ];

  return (
    <section aria-label={t('Key metrics')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, index) => {
        const filled = Math.round(Math.min(1, Math.max(0, card.progress)) * TICKS);
        return (
          <div key={card.label} className="surface-card tilt p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{card.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md border-[1.5px] border-ink text-ink">
                <card.icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-none tracking-tight text-ink">
              <CountUp value={card.value} />
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">{card.sub}</div>
            <div className="mt-4 flex h-3 items-end gap-[3px]" aria-hidden="true">
              {Array.from({ length: TICKS }, (_, tick) => {
                const on = tick < filled;
                return (
                  <motion.span
                    key={tick}
                    className="h-full flex-1 origin-bottom"
                    style={{ background: on ? card.tone : 'var(--line-strong)', opacity: on ? 1 : 0.55 }}
                    initial={reduceMotion ? false : { scaleY: 0.15 }}
                    animate={{ scaleY: on ? 1 : 0.45 }}
                    transition={{ delay: 0.25 + index * 0.08 + tick * 0.018, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
