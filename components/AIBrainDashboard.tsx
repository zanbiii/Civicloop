'use client';

import { ArrowRight, Brain, CircleCheck, Clock, GitMerge, Route, ShieldCheck, Siren, TriangleAlert, Users } from 'lucide-react';
import {
  CATEGORY_META,
  COMPLAINT_CATEGORIES,
  DEPARTMENTS,
  DEPARTMENT_META,
  type AgentAuditLog,
  type BrainTelemetry,
  type CivicTicket,
  type RoutingOverride,
} from '@/types/civic';
import AgentTerminal from '@/components/AgentTerminal';
import { cn } from '@/lib/cn';

/* Validated reference palette (dataviz skill): one magnitude series + the fixed status roles. */
const SERIES_1 = '#2a78d6';
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' } as const;
const OVERRIDE_ACTIVATION_WEIGHT = 0.55;

const CLOSED = new Set<CivicTicket['status']>(['Resolved', 'Rejected']);

export function computeBrainTelemetry(tickets: CivicTicket[], overrides: RoutingOverride[]): BrainTelemetry {
  const masters = tickets.filter((ticket) => ticket.isMaster);
  const open = masters.filter((ticket) => !CLOSED.has(ticket.status) && !ticket.sla.metAt);
  const totalReports = masters.reduce((sum, ticket) => sum + ticket.impactCount, 0);
  const duplicatesMerged = Math.max(0, totalReports - masters.length);

  const citizens = new Set<string>();
  masters.forEach((ticket) => {
    citizens.add(ticket.reporter.id);
    ticket.supporters.forEach((supporter) => citizens.add(supporter.reporter.id));
  });

  const rerouted = masters.filter((ticket) => ticket.routingHistory.some((event) => event.trigger === 'cov-reroute')).length;
  const resolved = masters.filter((ticket) => ticket.resolvedAt);
  const avgResolutionHours = resolved.length
    ? resolved.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()), 0) /
      resolved.length /
      3_600_000
    : 0;

  return {
    totalReports,
    masterIssues: masters.length,
    duplicatesMerged,
    duplicateReductionPercent: totalReports ? Math.round((duplicatesMerged / totalReports) * 100) : 0,
    citizensEngaged: citizens.size,
    slaOnTrack: open.filter((ticket) => ticket.sla.health === 'on_track').length,
    slaWarning: open.filter((ticket) => ticket.sla.health === 'warning').length,
    slaBreached: open.filter((ticket) => ticket.sla.health === 'breached').length,
    slaMet: masters.filter((ticket) => ticket.sla.health === 'met').length,
    autoEscalations: masters.filter((ticket) => ticket.sla.escalationLevel > 0).length,
    routingOverrides: overrides.length,
    ticketsAutoCorrected: overrides.reduce((sum, override) => sum + override.autoCorrectedCount, 0),
    routingAccuracyPercent: masters.length ? Math.round(((masters.length - rerouted) / masters.length) * 100) : 100,
    proofVerified: masters.filter((ticket) => ticket.proof?.verdict === 'verified').length,
    proofRejected: masters.filter((ticket) => ticket.proof?.verdict === 'rejected').length,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    byDepartment: DEPARTMENTS.map((department) => {
      const inDept = masters.filter((ticket) => ticket.assignedDepartment === department);
      return {
        department,
        open: inDept.filter((ticket) => !CLOSED.has(ticket.status)).length,
        resolved: inDept.filter((ticket) => ticket.status === 'Resolved').length,
        breached: inDept.filter((ticket) => !CLOSED.has(ticket.status) && ticket.sla.health === 'breached').length,
      };
    }),
    byCategory: COMPLAINT_CATEGORIES.map((category) => ({
      category,
      count: masters.filter((ticket) => ticket.category === category).reduce((sum, ticket) => sum + ticket.impactCount, 0),
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Brain; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HBar({ label, value, max, title }: { label: React.ReactNode; value: number; max: number; title: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-2 text-xs" title={title}>
      <span className="truncate text-slate-600">{label}</span>
      <div className="h-3 rounded-r bg-slate-50">
        <div className="h-full rounded-r" style={{ width: `${width}%`, backgroundColor: SERIES_1 }} />
      </div>
      <span className="text-right font-semibold tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

interface AIBrainDashboardProps {
  tickets: CivicTicket[];
  overrides: RoutingOverride[];
  logs: AgentAuditLog[];
  liveAi: boolean;
}

export default function AIBrainDashboard({ tickets, overrides, logs, liveAi }: AIBrainDashboardProps) {
  const t = computeBrainTelemetry(tickets, overrides);
  const openTotal = t.slaOnTrack + t.slaWarning + t.slaBreached;
  const slaSegments = [
    { key: 'on_track', label: 'On track', value: t.slaOnTrack, color: STATUS.good, icon: CircleCheck },
    { key: 'warning', label: 'Warning (≥75%)', value: t.slaWarning, color: STATUS.warning, icon: TriangleAlert },
    { key: 'breached', label: 'Breached', value: t.slaBreached, color: STATUS.critical, icon: Siren },
  ];
  const maxDeptOpen = Math.max(1, ...t.byDepartment.map((row) => row.open));
  const maxCategory = Math.max(1, ...t.byCategory.map((row) => row.count));
  const escalated = tickets
    .filter((ticket) => ticket.isMaster && ticket.sla.escalationLevel > 0 && !CLOSED.has(ticket.status))
    .sort((a, b) => b.sla.escalationLevel - a.sla.escalationLevel);
  const sortedOverrides = [...overrides].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Brain className="h-5 w-5" /> CivicSense AI Brain
          </h2>
          <p className="text-xs text-slate-500">Five agents, one feedback loop — deduplication, self-healing routing, SLA sentinel and proof-gated closure.</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            liveAi ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', liveAi ? 'animate-pulse bg-emerald-500' : 'bg-slate-400')} />
          {liveAi ? 'Mistral live (pixtral-12b + mistral-large)' : 'Offline mock mode — set MISTRAL_API_KEY for live vision'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label="Citizen reports" value={String(t.totalReports)} sub={`${t.citizensEngaged} unique citizens`} />
        <Kpi icon={GitMerge} label="Master issues" value={String(t.masterIssues)} sub={`${t.duplicatesMerged} duplicates merged`} />
        <Kpi icon={GitMerge} label="Duplicate reduction" value={`${t.duplicateReductionPercent}%`} sub="fewer tickets for crews" />
        <Kpi icon={Route} label="Routing accuracy" value={`${t.routingAccuracyPercent}%`} sub={`${t.ticketsAutoCorrected} auto-corrected`} />
        <Kpi icon={Siren} label="Auto-escalations" value={String(t.autoEscalations)} sub="breaches briefed upward" />
        <Kpi icon={ShieldCheck} label="Proof verified" value={String(t.proofVerified)} sub={`${t.proofRejected} fraudulent/mismatched rejected`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="SLA health · open issues" subtitle={`${openTotal} open · ${t.slaMet} closed within SLA · avg resolution ${t.avgResolutionHours}h`}>
          {openTotal > 0 ? (
            <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded">
              {slaSegments
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <div
                    key={segment.key}
                    title={`${segment.label}: ${segment.value}`}
                    style={{ width: `${(segment.value / openTotal) * 100}%`, backgroundColor: segment.color }}
                  />
                ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No open issues.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {slaSegments.map((segment) => (
              <span key={segment.key} className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} />
                <segment.icon className="h-3.5 w-3.5 text-slate-500" />
                {segment.label} <span className="font-semibold text-slate-900">{segment.value}</span>
              </span>
            ))}
          </div>
        </Card>

        <Card title="Open issues by department" subtitle="Bar = open master issues; resolved and breached counts alongside">
          <div className="space-y-2">
            {t.byDepartment.map((row) => (
              <div key={row.department} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <HBar
                  label={`${DEPARTMENT_META[row.department].icon} ${row.department}`}
                  value={row.open}
                  max={maxDeptOpen}
                  title={`${row.department}: ${row.open} open, ${row.resolved} resolved, ${row.breached} breached`}
                />
                <div className="flex gap-2 text-[11px] tabular-nums text-slate-500">
                  <span className="flex items-center gap-0.5" title="Resolved">
                    <CircleCheck className="h-3 w-3" /> {row.resolved}
                  </span>
                  <span className={cn('flex items-center gap-0.5', row.breached > 0 && 'font-semibold text-red-600')} title="SLA breached">
                    <Siren className="h-3 w-3" /> {row.breached}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Citizen reports by category" subtitle="Counts every co-reporter, not just master tickets">
          <div className="space-y-2">
            {t.byCategory.map((row) => (
              <HBar
                key={row.category}
                label={`${CATEGORY_META[row.category].icon} ${row.category}`}
                value={row.count}
                max={maxCategory}
                title={`${row.category}: ${row.count} citizen reports`}
              />
            ))}
          </div>
        </Card>

        <Card title="Auto-escalation log" subtitle="Issues the SLA Sentinel pushed up the chain, with generated briefings">
          {escalated.length === 0 ? (
            <p className="text-xs text-slate-500">No open escalations.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {escalated.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">{ticket.referenceCode}</span>
                    <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Level {ticket.sla.escalationLevel}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-red-800">→ {ticket.sla.escalatedTo}</div>
                  {ticket.sla.escalationBriefing && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{ticket.sla.escalationBriefing}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Self-healing routing graph"
        subtitle={`Corrections learned from CoVs. At ≥${Math.round(OVERRIDE_ACTIVATION_WEIGHT * 100)}% weight a rule rewrites routing for every new report in its zone.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[11px] text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-3 font-semibold">Category · zone</th>
                <th className="py-2 pr-3 font-semibold">Correction</th>
                <th className="py-2 pr-3 font-semibold">Weight</th>
                <th className="py-2 pr-3 text-right font-semibold">Corrections</th>
                <th className="py-2 pr-3 text-right font-semibold">Auto-corrected</th>
                <th className="py-2 font-semibold">Last applied</th>
              </tr>
            </thead>
            <tbody>
              {sortedOverrides.map((override) => {
                const active = override.weight >= OVERRIDE_ACTIVATION_WEIGHT;
                return (
                  <tr key={override.id} className="border-b border-slate-50 align-top last:border-0" title={override.reason}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-900">
                        {CATEGORY_META[override.category].icon} {override.category}
                      </div>
                      <div className="text-[11px] text-slate-500">{override.zoneKey.replace(':', ' · ')}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1 text-slate-700">
                        <span className="text-slate-400 line-through">{override.fromDepartment}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="font-semibold">{override.toDepartment}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 w-24 rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${override.weight * 100}%`, backgroundColor: SERIES_1 }} />
                          <div
                            className="absolute -top-0.5 h-3 w-px bg-slate-500"
                            style={{ left: `${OVERRIDE_ACTIVATION_WEIGHT * 100}%` }}
                            title="Activation threshold"
                          />
                        </div>
                        <span className="tabular-nums font-semibold text-slate-800">{Math.round(override.weight * 100)}%</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {active ? 'Active' : 'Learning'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-800">{override.occurrences}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">{override.autoCorrectedCount}</td>
                    <td className="py-2 text-[11px] text-slate-500" suppressHydrationWarning>
                      {override.lastAppliedAt ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(override.lastAppliedAt).toLocaleString()}
                        </span>
                      ) : (
                        'Not yet'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AgentTerminal logs={logs} liveAi={liveAi} heightClass="h-96" />
    </div>
  );
}
