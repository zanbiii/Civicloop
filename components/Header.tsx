'use client';

import { useState } from 'react';
import { Bot, Building, Globe, HardHat, LogOut, Phone, Rocket, ShieldCheck, Siren, User, X } from 'lucide-react';
import type { SessionUser, UserRole } from '@/types/civic';
import { cn } from '@/lib/cn';

export type AppLanguage = 'en' | 'kn' | 'hi';

const LANGUAGE_LABELS: Record<AppLanguage, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' };

const ROLE_META: Record<SessionUser['role'], { label: string; icon: typeof User }> = {
  citizen: { label: 'Citizen', icon: User },
  authority: { label: 'Authority', icon: Building },
  volunteer: { label: 'CoV', icon: HardHat },
  admin: { label: 'Admin', icon: Bot },
};

/** Roles offered in the demo-mode quick-switcher — Authority stays reachable via real sign-in, just not this shortcut. */
const QUICK_SWITCH_ROLES: UserRole[] = ['citizen', 'volunteer', 'admin'];

function sessionDisplayName(user: SessionUser): string {
  if (user.role === 'citizen') return user.profile.displayName;
  if (user.role === 'authority') return user.profile.name;
  if (user.role === 'volunteer') return user.profile.name;
  return user.profile.name;
}

function sessionSubline(user: SessionUser): string {
  if (user.role === 'citizen') return user.profile.maskedPhone;
  if (user.role === 'authority') return `${user.profile.department} · ${user.profile.zone}`;
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
  const [sosDismissed, setSosDismissed] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const RoleIcon = sessionUser ? ROLE_META[sessionUser.role].icon : User;

  return (
    <div className="sticky top-0 z-50">
      {!sosDismissed && (
        <div className="flex items-center justify-center gap-2 bg-red-600 px-3 py-1.5 text-center text-xs font-semibold text-white sm:text-sm">
          <Siren className="h-4 w-4 shrink-0 animate-pulse" />
          <span>Life-threatening emergency? Don&apos;t wait for a ticket —</span>
          <a href="tel:112" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-red-100">
            <Phone className="h-3.5 w-3.5" /> Call 112
          </a>
          <button
            type="button"
            onClick={() => setSosDismissed(true)}
            className="ml-1 shrink-0 rounded p-0.5 hover:bg-white/20"
            aria-label="Dismiss emergency banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg">
              🔁
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-base font-bold text-slate-900">Civicloop</div>
              <div className="hidden truncate text-[11px] text-slate-500 sm:block">
                Decentralized Civic Bounty Network · Powered by Corporate CSR &amp; Community Volunteers (CoV)
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDemoMode}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                demoMode
                  ? 'border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100',
              )}
              title="Quick Demo Mode pre-fills forms and skips real OTP delivery so you can click through the whole flow."
            >
              <Rocket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quick Demo Mode</span>
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
              <div className="flex items-center rounded-full border border-violet-200 bg-violet-50 p-0.5" role="group" aria-label="Quick role switch">
                {QUICK_SWITCH_ROLES.map((role) => {
                  const Icon = ROLE_META[role].icon;
                  const active = sessionUser?.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onQuickSwitchRole(role)}
                      title={`Switch to the demo ${ROLE_META[role].label.toLowerCase()} view`}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition',
                        active ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{ROLE_META[role].label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <span
              className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 md:flex"
              title="Personal phone numbers and identities are scrubbed from public view — only issue location and category are shared with authorities."
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy-first
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((open) => !open)}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-1 pr-1 py-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                  <RoleIcon className="h-3.5 w-3.5" />
                </span>
                <div className="hidden leading-tight sm:block">
                  <div className="text-[11px] font-semibold text-slate-800">{sessionDisplayName(sessionUser)}</div>
                  <div className="text-[10px] text-slate-500">{sessionSubline(sessionUser)}</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
