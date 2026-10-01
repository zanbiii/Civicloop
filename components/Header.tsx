'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, ChevronDown, Globe, HardHat, LogOut, Moon, Phone, Repeat2, Rocket, Search, ShieldCheck, Siren, Sun, User, X } from 'lucide-react';
import type { SessionUser, UserRole } from '@/types/civic';
import { cn } from '@/lib/cn';
import type { AppLanguage } from '@/lib/i18n';
import { useEscapeKey } from '@/lib/useEscapeKey';
import { useTranslate } from '@/components/AppLanguageProvider';
import { useAppTheme } from '@/components/AppThemeProvider';
import ScrambleText from '@/components/fx/ScrambleText';

const LANGUAGE_LABELS: Record<AppLanguage, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' };

const ROLE_META: Record<SessionUser['role'], { label: string; icon: typeof User }> = {
  citizen: { label: 'Citizen', icon: User },
  volunteer: { label: 'CoV', icon: HardHat },
  admin: { label: 'Admin', icon: Bot },
};

/** Roles offered in the demo-mode quick-switcher. */
const QUICK_SWITCH_ROLES: UserRole[] = ['citizen', 'volunteer', 'admin'];

function sessionDisplayName(user: SessionUser): string {
  if (user.role === 'citizen') return user.profile.displayName;
  if (user.role === 'volunteer') return user.profile.name;
  return user.profile.name;
}

function sessionSubline(user: SessionUser): string {
  if (user.role === 'citizen') return user.profile.maskedPhone;
  if (user.role === 'volunteer') return `${user.profile.badge} · ${user.profile.zone}`;
  return 'Super-admin clearance';
}

interface HeaderProps {
  sessionUser: SessionUser | null;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  /** Demo-mode only: jump straight into a seeded account for the chosen role. */
  onQuickSwitchRole?: (role: UserRole) => void;
  /** Page title shown in the top bar once signed in (the sidebar owns navigation). */
  title?: string;
  /** Opens the ⌘K command palette. */
  onOpenSearch?: () => void;
}

const SECTION_LINKS = [
  { href: '#loop', label: 'How the loop works' },
  { href: '#bounty', label: 'Bounty map' },
  { href: '#csr', label: 'CSR funding' },
];

/** Landing-page section links with a glowing pill that glides to whichever link is hovered. */
function SectionNav() {
  const t = useTranslate();
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <nav className="ml-6 hidden items-center gap-1 xl:flex" aria-label={t('Sections')} onMouseLeave={() => setHovered(null)}>
      {SECTION_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onMouseEnter={() => setHovered(link.href)}
          onFocus={() => setHovered(link.href)}
          onBlur={() => setHovered(null)}
          data-magnetic
          className="fx-navlink whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 transition-colors hover:text-slate-900"
        >
          {hovered === link.href && (
            <motion.span layoutId="fx-nav-pill" className="fx-nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} aria-hidden="true" />
          )}
          <span className="relative">{t(link.label)}</span>
        </a>
      ))}
    </nav>
  );
}

export default function Header({
  sessionUser,
  demoMode,
  onToggleDemoMode,
  language,
  onLanguageChange,
  onOpenAuth,
  onLogout,
  onQuickSwitchRole,
  title,
  onOpenSearch,
}: HeaderProps) {
  const t = useTranslate();
  const { theme, toggleTheme } = useAppTheme();
  const [sosDismissed, setSosDismissed] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setLanguageMenuOpen(false), languageMenuOpen);

  // A document listener rather than a full-screen overlay: the top bar's backdrop-filter
  // makes it the containing block for fixed children, so an overlay would only cover the header.
  useEffect(() => {
    if (!languageMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setLanguageMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [languageMenuOpen]);

  const RoleIcon = sessionUser ? ROLE_META[sessionUser.role].icon : User;

  // Arrow keys walk the language menu; focus wraps at both ends.
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  };

  useEffect(() => {
    if (!languageMenuOpen) return;
    languageMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [languageMenuOpen]);

  return (
    <div className="sticky top-0 z-50">
      {!sosDismissed && (
        <div className="flex min-h-9 items-center justify-center gap-2 bg-[#a92b2b] px-3 py-1.5 text-center text-[11px] font-semibold text-white sm:text-xs">
          <Siren className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('Life-threatening emergency? Don’t wait for a ticket —')}</span>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 underline-offset-2 transition hover:bg-white/25 hover:underline"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {t('Call 112')}
          </a>
          <button
            type="button"
            onClick={() => setSosDismissed(true)}
            className="ml-1 shrink-0 rounded-full p-1 transition hover:bg-white/20 active:scale-90"
            aria-label={t('Dismiss emergency banner')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="mx-auto flex max-w-[96rem] items-center gap-3 px-3 py-2.5 sm:px-5 lg:px-8">
          <div className={cn('flex min-w-0 items-center gap-2.5', sessionUser && 'lg:hidden')}>
            <div className="side-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]">
              <Repeat2 className="h-5 w-5" strokeWidth={2.3} aria-hidden="true" />
            </div>
            <div className="hidden min-w-0 leading-tight sm:block">
              <div className="truncate font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight text-slate-900">
                civic<span className="side-wordmark">loop</span>
              </div>
              <div className="hidden truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:block">
                {t('A better loop for city fixes')}
              </div>
            </div>
          </div>

          {!sessionUser && <SectionNav />}

          {sessionUser && title && (
            <div className="hidden min-w-0 lg:block">
              <div className="eyebrow">{t(ROLE_META[sessionUser.role].label)} {t('workspace')}</div>
              <h1 className="truncate text-2xl font-extrabold leading-tight text-slate-900">
                <ScrambleText text={t(title)} duration={650} />
              </h1>
            </div>
          )}

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                data-magnetic
                className="btn btn-secondary btn-sm min-h-9 gap-2 rounded-full px-3 font-medium text-slate-500"
                aria-label={t('Search')}
                title={`${t('Search')} (Ctrl+K)`}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="fx-kbd hidden lg:inline">⌘K</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleDemoMode}
              className={cn(
                'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-2 text-[11px] font-semibold transition active:scale-[0.97] sm:px-3 sm:py-1.5 sm:text-xs',
                demoMode
                  ? 'border-violet-300 bg-violet-100 text-violet-700 hover:border-violet-400 hover:bg-violet-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700',
              )}
              title={t('Quick Demo Mode pre-fills forms and skips real OTP delivery so you can click through the whole flow.')}
              aria-pressed={demoMode}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">{t('Quick Demo Mode')}</span>
              <span
                className={cn(
                  'ml-0.5 flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
                  demoMode ? 'bg-violet-600' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'h-3 w-3 rounded-full bg-white shadow transition-transform',
                    demoMode ? 'translate-x-3' : 'translate-x-0',
                  )}
                />
              </span>
            </button>

            {demoMode && onQuickSwitchRole && (
              <div className="hidden items-center gap-0.5 rounded-full border border-violet-200/80 bg-violet-50 p-0.5 sm:flex" role="group" aria-label={t('Quick role switch')}>
                {QUICK_SWITCH_ROLES.map((role) => {
                  const Icon = ROLE_META[role].icon;
                  const active = sessionUser?.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onQuickSwitchRole(role)}
                      title={`${t('Switch to the demo')} ${t(ROLE_META[role].label.toLowerCase())} ${t('view')}`}
                      aria-pressed={active}
                      className={cn(
                        'flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition active:scale-95',
                        active ? 'bg-violet-600 text-white shadow-sm' : 'text-violet-700 hover:bg-violet-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden 2xl:inline">{t(ROLE_META[role].label)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <span
              className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 min-[1760px]:flex"
              title={t('Personal phone numbers and identities are scrubbed from public view — only issue location and category are shared with CoVs.')}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> {t('Privacy-first')}
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={toggleTheme}
                data-magnetic
                className="btn btn-secondary btn-icon h-9 w-9"
                aria-label={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
                title={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div ref={languageMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={languageMenuOpen}
                aria-label={`${t('Language')}: ${LANGUAGE_LABELS[language]}`}
                className={cn('btn btn-secondary btn-sm min-h-9 rounded-full px-2.5 font-medium', languageMenuOpen && 'border-slate-400')}
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{LANGUAGE_LABELS[language]}</span>
                <ChevronDown className={cn('hidden h-3 w-3 transition-transform duration-200 sm:block', languageMenuOpen && 'rotate-180')} aria-hidden="true" />
              </button>
              {languageMenuOpen && (
                <>
                  <div
                    role="menu"
                    onKeyDown={onMenuKeyDown}
                    className="fx-menu absolute right-0 z-50 mt-1.5 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
                  >
                    {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map((code) => (
                      <button
                        key={code}
                        type="button"
                        role="menuitemradio"
                        aria-checked={code === language}
                        onClick={() => {
                          onLanguageChange(code);
                          setLanguageMenuOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-surface-2',
                          code === language ? 'font-semibold text-slate-900' : 'text-slate-600',
                        )}
                      >
                        {LANGUAGE_LABELS[code]}
                        {code === language && <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {sessionUser ? (
              <div className="flex animate-fade-in items-center gap-2 rounded-full border-[1.5px] border-slate-300 bg-white py-1 pl-1 pr-1">
                <span className="chip-ink flex h-7 w-7 items-center justify-center rounded-full">
                  <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="hidden whitespace-nowrap leading-tight sm:block lg:hidden xl:block">
                  <div className="text-[11px] font-semibold text-slate-800">{sessionDisplayName(sessionUser)}</div>
                  <div className="text-[10px] text-slate-500">{t(sessionSubline(sessionUser))}</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700 active:scale-90 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  aria-label={t('Sign out')}
                  title={t('Sign out')}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={onOpenAuth} className="btn btn-primary btn-sm min-h-9 rounded-full px-4 font-bold">
                {t('Sign in')}
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
