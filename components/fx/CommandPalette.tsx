'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { useEscapeKey } from '@/lib/useEscapeKey';
import { useTranslate } from '@/components/AppLanguageProvider';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Extra text matched by the query but not shown (codes, addresses, categories). */
  keywords?: string;
  onRun: () => void;
}

export interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

const MAX_PER_GROUP = 8;

/**
 * ⌘K / Ctrl+K search: dims the page, expands a glowing panel and staggers results in.
 * Arrow keys move the highlight, Enter runs, Esc closes; hovered rows get a spotlight.
 */
export default function CommandPalette({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: PaletteGroup[] }) {
  if (!open) return null;
  return <PalettePanel onClose={onClose} groups={groups} />;
}

function PalettePanel({ onClose, groups }: { onClose: () => void; groups: PaletteGroup[] }) {
  const t = useTranslate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        label: group.label,
        items: group.items
          .filter((item) => !needle || `${item.label} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(needle))
          .slice(0, MAX_PER_GROUP),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const flat = filtered.flatMap((group) => group.items);
  const safeActive = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.onRun();
  };

  let index = -1;
  return (
    <div className="fx-palette-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('Search Civicloop')} className="fx-palette" onClick={(event) => event.stopPropagation()}>
        <div className="fx-palette-inputrow flex items-center gap-3 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-[var(--signal)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => (flat.length ? (Math.min(value, flat.length - 1) + 1) % flat.length : 0));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => (flat.length ? (Math.min(value, flat.length - 1) - 1 + flat.length) % flat.length : 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(flat[safeActive]);
              }
            }}
            placeholder={t('Search reports, pages and actions…')}
            className="fx-palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="fx-palette-list"
            aria-activedescendant={flat[safeActive] ? `fx-palette-${flat[safeActive].id}` : undefined}
          />
          <span className="fx-kbd">ESC</span>
        </div>

        <div ref={listRef} id="fx-palette-list" role="listbox" className="soft-scrollbar max-h-[56vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="empty-state m-2 py-8">
              <span className="empty-state-icon">
                <Search className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-slate-700">{t('No matches.')}</p>
            </div>
          ) : (
            filtered.map((group) => (
              <div key={group.label} className="pb-1">
                <div className="eyebrow px-3 pb-1 pt-2">{t(group.label)}</div>
                {group.items.map((item) => {
                  index += 1;
                  const position = index;
                  const selected = position === safeActive;
                  return (
                    <button
                      key={item.id}
                      id={`fx-palette-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => position !== safeActive && setActive(position)}
                      onClick={() => run(item)}
                      className="fx-palette-item fx-spot"
                      style={{ '--i': position } as CSSProperties}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line-strong)] text-[var(--signal)]">
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
                        {item.hint && <span className="block truncate text-[11px] text-slate-500">{item.hint}</span>}
                      </span>
                      {selected && <CornerDownLeft className="h-4 w-4 shrink-0 text-[var(--signal)]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--line-strong)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          <span className="fx-kbd">↑↓</span> {t('navigate')}
          <span className="fx-kbd">↵</span> {t('open')}
          <span className="ml-auto">{flat.length} {t('results')}</span>
        </div>
      </div>
    </div>
  );
}
