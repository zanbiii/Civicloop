'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Terminal } from 'lucide-react';
import { AGENT_META, AGENT_NAMES, type AgentAuditLog, type AgentLogLevel, type AgentName } from '@/types/civic';
import { cn } from '@/lib/cn';

interface AgentTerminalProps {
  logs: AgentAuditLog[];
  title?: string;
  liveAi?: boolean;
  className?: string;
  heightClass?: string;
}

const LEVEL_TEXT: Record<AgentLogLevel, string> = {
  info: 'text-slate-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-red-300',
};

const LEVEL_MARK: Record<AgentLogLevel, string> = {
  info: '·',
  success: '✓',
  warning: '!',
  error: '✗',
};

function clock(iso: string): string {
  const date = new Date(iso);
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function AgentTerminal({
  logs,
  title = 'CivicSense · live agent decision stream',
  liveAi,
  className,
  heightClass = 'h-80',
}: AgentTerminalProps) {
  const [agentFilter, setAgentFilter] = useState<AgentName | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const visible = useMemo(
    () =>
      logs
        .filter((entry) => agentFilter === 'all' || entry.agent === agentFilter)
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [logs, agentFilter],
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (node && pinnedToBottom.current) node.scrollTop = node.scrollHeight;
  }, [visible.length]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 font-mono text-slate-200 shadow-lg', className)}>
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </span>
        <Terminal className="ml-1 h-3.5 w-3.5 text-slate-500" />
        <span className="truncate text-[11px] text-slate-400">{title}</span>
        {liveAi !== undefined && (
          <span
            className={cn(
              'ml-auto flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold',
              liveAi ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/60 text-slate-300',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', liveAi ? 'animate-pulse bg-emerald-400' : 'bg-slate-400')} />
            {liveAi ? 'MISTRAL LIVE' : 'OFFLINE MOCK'}
          </span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-1.5">
        {(['all', ...AGENT_NAMES] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setAgentFilter(name)}
            className={cn(
              'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition',
              agentFilter === name ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {name === 'all' ? 'ALL' : `${AGENT_META[name].icon} ${name}`}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget;
          pinnedToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
        }}
        className={cn('overflow-y-auto px-3 py-2 text-[11px] leading-relaxed', heightClass)}
        role="log"
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <div className="py-6 text-center text-slate-600">No agent activity yet — submit a report to watch the pipeline run.</div>
        ) : (
          visible.map((entry) => {
            const open = expanded.has(entry.id);
            return (
              <div key={entry.id} className="border-b border-slate-900 py-1 last:border-0">
                <button type="button" onClick={() => toggle(entry.id)} className="flex w-full items-start gap-2 text-left hover:bg-slate-900/60">
                  <ChevronRight className={cn('mt-0.5 h-3 w-3 shrink-0 text-slate-600 transition-transform', open && 'rotate-90')} />
                  <span className="shrink-0 text-slate-600" suppressHydrationWarning>
                    {clock(entry.createdAt)}
                  </span>
                  <span className="shrink-0 font-bold" style={{ color: AGENT_META[entry.agent].color }}>
                    {entry.agent}
                  </span>
                  <span className="shrink-0 text-slate-500">{entry.action}</span>
                  <span className={cn('min-w-0 flex-1', LEVEL_TEXT[entry.level])}>
                    <span className="mr-1 font-bold">{LEVEL_MARK[entry.level]}</span>
                    {entry.message}
                  </span>
                </button>
                {open && (
                  <div className="ml-5 mt-1 space-y-1">
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500">
                      <span>mode: {entry.mode}</span>
                      <span>latency: {entry.latencyMs} ms</span>
                      {entry.confidence !== null && <span>confidence: {entry.confidence}%</span>}
                      {entry.ticketId && <span>ticket: {entry.ticketId}</span>}
                    </div>
                    <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-[10px] text-slate-400">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
