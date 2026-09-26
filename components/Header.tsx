'use client';

import { useState } from 'react';
import { Bot, Globe, HardHat, LogOut, Moon, Phone, Repeat2, Rocket, ShieldCheck, Siren, Sun, User, X } from 'lucide-react';
import type { SessionUser, UserRole } from '@/types/civic';
import { cn } from '@/lib/cn';
import type { AppLanguage } from '@/lib/i18n';
import { useTranslate } from '@/components/AppLanguageProvider';
import { useAppTheme } from '@/components/AppThemeProvider';

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
}: HeaderProps) {
  const t = useTranslate();
  const { theme, toggleTheme } = useAppTheme();
  const [sosDismissed, setSosDismissed] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const RoleIcon = sessionUser ? ROLE_META[sessionUser.role].icon : User;

  return (
    <div className="sticky top-0 z-50">
      {!sosDismissed && (
        <div className="flex min-h-9 items-center justify-center gap-2 bg-[#a92b2b] px-3 py-1.5 text-center text-[11px] font-semibold text-white sm:text-xs">
          <Siren className="h-4 w-4 shrink-0" />
          <span>{t('Life-threatening emergency? Don’t wait for a ticket —')}</span>
          <a href="tel:112" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-red-100">
            <Phone className="h-3.5 w-3.5" /> {t('Call 112')}
          </a>
          <button
            type="button"
            onClick={() => setSosDismissed(true)}
            className="ml-1 shrink-0 rounded p-0.5 hover:bg-white/20"
            aria-label={t('Dismiss emergency banner')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <header className="border-b border-slate-200/80 bg-white/90 shadow-[0_1px_2px_rgb(15_23_42_/3%)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-3 py-2.5 sm:px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-700 text-white shadow-lg shadow-emerald-900/15">
              <Repeat2 className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">Civicloop</div>
              <div className="hidden truncate text-[10px] font-medium tracking-wide text-slate-500 sm:block">
                {t('A better loop for city fixes')}
              </div>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleDemoMode}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-[11px] font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs',
                demoMode
                  ? 'border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100',
              )}
              title={t('Quick Demo Mode pre-fills forms and skips real OTP delivery so you can click through the whole flow.')}
              aria-pressed={demoMode}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Quick Demo Mode')}</span>
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
              <div className="flex items-center gap-0.5 rounded-full border border-violet-200/80 bg-violet-50 p-0.5" role="group" aria-label={t('Quick role switch')}>
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
                        'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition',
                        active ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{t(ROLE_META[role].label)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <span
              className="hidden items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 lg:flex"
              title={t('Personal phone numbers and identities are scrubbed from public view — only issue location and category are shared with CoVs.')}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> {t('Privacy-first')}
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                aria-label={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
                title={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((open) => !open)}
                className="flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{LANGUAGE_LABELS[language]}</span>
              </button>
              {languageMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLanguageMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(code);
                          setLanguageMenuOpen(false);
                        }}
                        className={cn(
                          'block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50',
                          code === language ? 'font-semibold text-slate-900' : 'text-slate-600',
                        )}
                      >
                        {LANGUAGE_LABELS[code]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {sessionUser ? (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-1 shadow-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-800 text-white">
                  <RoleIcon className="h-3.5 w-3.5" />
                </span>
                <div className="hidden leading-tight sm:block">
                  <div className="text-[11px] font-semibold text-slate-800">{sessionDisplayName(sessionUser)}</div>
                  <div className="text-[10px] text-slate-500">{t(sessionSubline(sessionUser))}</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={t('Sign out')}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-9 rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900"
              >
                {t('Sign in')}
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
