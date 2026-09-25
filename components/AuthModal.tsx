'use client';

import { useState } from 'react';
import { Bot, HardHat, KeyRound, LoaderCircle, Mail, Phone, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import {
  DEPARTMENTS,
  maskPhone,
  pseudonymFor,
  type AdminProfile,
  type Department,
  type PublicReporter,
  type SessionUser,
  type UserRole,
  type VolunteerProfile,
} from '@/types/civic';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';

const DEMO_OTP = '123456';
const DEMO_ADMIN_PASSCODE = 'CIVICBRAIN';

const ZONES = ['BBMP-South', 'BBMP-Bommanahalli', 'BBMP-East', 'BBMP-Mahadevapura', 'BBMP-North', 'BBMP-West'] as const;

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
  demoMode?: boolean;
  initialRole?: UserRole;
}

const ROLE_TABS: Array<{ role: UserRole; label: string; icon: typeof User }> = [
  { role: 'citizen', label: 'Citizen', icon: User },
  { role: 'volunteer', label: 'CoV', icon: HardHat },
  { role: 'admin', label: 'Administrator', icon: Bot },
];

// Matches lib/seedData's `citizen-<last 4 digits>` so a seeded resident who signs in sees their own reports.
function makeCitizenId(handle: string): string {
  const digits = handle.replace(/\D/g, '');
  return digits.length >= 4 ? `citizen-${digits.slice(-4)}` : `citizen-${pseudonymFor(handle).replace(/\D/g, '')}`;
}

/** Shared OTP step for both the Citizen and CoV flows. */
function OtpStep({
  destination,
  demoMode,
  loading,
  error,
  onVerify,
  onBack,
}: {
  destination: string;
  demoMode: boolean;
  loading: boolean;
  error: string | null;
  onVerify: (otp: string) => void;
  onBack: () => void;
}) {
  const t = useTranslate();
  const [otp, setOtp] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          {t('We sent a 6-digit code to')} <span className="font-semibold text-slate-900">{destination}</span>.
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{t('This is a hackathon preview — no real SMS/email is sent.')}</p>
      </div>

      <input
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="••••••"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none focus:border-slate-500"
      />

      <button
        type="button"
        onClick={() => setOtp(DEMO_OTP)}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition',
          demoMode
            ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
            : 'border-slate-200 text-slate-500 hover:bg-slate-50',
        )}
      >
        <Sparkles className="h-3.5 w-3.5" /> {t('Auto-Fill Demo OTP')} {DEMO_OTP}
      </button>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          {t('Back')}
        </button>
        <button
          type="button"
          disabled={otp.length !== 6 || loading}
          onClick={() => onVerify(otp)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('Verify & Continue')}
        </button>
      </div>
    </div>
  );
}

function CitizenAuth({ demoMode, onAuthenticated }: { demoMode: boolean; onAuthenticated: (user: SessionUser) => void }) {
  const t = useTranslate();
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const destination = method === 'phone' ? maskPhone(phone) : email;

  const sendOtp = () => {
    if (method === 'phone' && !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError(t('Enter a valid 10-digit Indian mobile number.'));
      return;
    }
    if (method === 'email' && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('Enter a valid email address.'));
      return;
    }
    setError(null);
    setStep('otp');
  };

  const verify = (otp: string) => {
    if (otp !== DEMO_OTP) {
      setError(`${t('Incorrect code — use the demo OTP')} ${DEMO_OTP} ${t('in this preview.')}`);
      return;
    }
    setVerifying(true);
    const handle = method === 'phone' ? phone.trim() : email.trim();
    const profile: PublicReporter = {
      id: makeCitizenId(handle),
      displayName: pseudonymFor(handle),
      maskedPhone: method === 'phone' ? maskPhone(phone) : t('Email verified'),
      verified: true,
      ward: null,
    };
    window.setTimeout(() => onAuthenticated({ role: 'citizen', profile }), 350);
  };

  if (step === 'otp') {
    return (
      <OtpStep
        destination={destination}
        demoMode={demoMode}
        loading={verifying}
        error={error}
        onVerify={verify}
        onBack={() => setStep('details')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMethod('phone')}
          className={cn('flex-1 rounded-md py-1.5', method === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
        >
          <Phone className="mr-1 inline h-3.5 w-3.5" /> {t('Phone + OTP')}
        </button>
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={cn('flex-1 rounded-md py-1.5', method === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
        >
          <Mail className="mr-1 inline h-3.5 w-3.5" /> {t('Email')}
        </button>
      </div>

      {method === 'phone' ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Mobile number')}</label>
          <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-slate-500">
            <span className="pl-3.5 text-sm text-slate-400">+91</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              placeholder="98451 20337"
              className="w-full rounded-xl bg-transparent px-2 py-3 text-sm text-slate-900 outline-none"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Email address')}</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('Your number and identity are never shown publicly — only your issue and its location reach CoVs.')}
      </p>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={sendOtp}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {t('Send OTP')}
      </button>
    </div>
  );
}

function CoVAuth({ demoMode, onAuthenticated }: { demoMode: boolean; onAuthenticated: (user: SessionUser) => void }) {
  const t = useTranslate();
  const [name, setName] = useState('');
  const [covId, setCovId] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [zone, setZone] = useState<(typeof ZONES)[number]>(ZONES[0]);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fillDemo = () => {
    setName('Ramesh K.');
    setCovId('COV-KOR-114');
    setPhone('9845098450');
    setUpiId('ramesh@oksbi');
    setDepartment('PWD/Roads');
    setZone('BBMP-South');
  };

  const sendOtp = () => {
    if (!name.trim() || !covId.trim()) {
      setError(t('Enter your name and CoV ID.'));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError(t('Enter a valid 10-digit Indian mobile number.'));
      return;
    }
    if (!/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) {
      setError(t('Enter a valid UPI ID for bounty payouts.'));
      return;
    }
    setError(null);
    setStep('otp');
  };

  const verify = (otp: string) => {
    if (otp !== DEMO_OTP) {
      setError(`${t('Incorrect code — use the demo OTP')} ${DEMO_OTP} ${t('in this preview.')}`);
      return;
    }
    setVerifying(true);
    const profile: VolunteerProfile = {
      id: `cov-${covId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim(),
      maskedPhone: maskPhone(phone),
      upiId: upiId.trim(),
      rating: 0,
      ratingCount: 0,
      tier: 'bronze',
      totalEarnedInr: 0,
      completedMissions: 0,
      badge: 'New CoV',
      department,
      zone,
      designation: 'Community Volunteer',
      homeBase: { lat: 12.9716, lng: 77.5946, zone },
    };
    window.setTimeout(() => onAuthenticated({ role: 'volunteer', profile }), 350);
  };

  if (step === 'otp') {
    return (
      <OtpStep
        destination={maskPhone(phone)}
        demoMode={demoMode}
        loading={verifying}
        error={error}
        onVerify={verify}
        onBack={() => setStep('details')}
      />
    );
  }

  return (
    <div className="space-y-3">
      {demoMode && (
        <button
          type="button"
          onClick={fillDemo}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
        >
          <Sparkles className="h-3.5 w-3.5" /> {t('Autofill a demo CoV (PWD/Roads, Koramangala)')}
        </button>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Full name')}</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Full name')}
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('CoV ID')}</label>
          <input
            value={covId}
            onChange={(event) => setCovId(event.target.value)}
            placeholder="COV-KOR-114"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Mobile number')}</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            placeholder="9900112233"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">{t('UPI ID for bounty payouts')}</label>
        <input
          value={upiId}
          onChange={(event) => setUpiId(event.target.value)}
          placeholder="name@bank"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Department')}</label>
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value as Department)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Zone')}</label>
          <select
            value={zone}
            onChange={(event) => setZone(event.target.value as (typeof ZONES)[number])}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={sendOtp}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {t('Send OTP')}
      </button>
    </div>
  );
}

function AdminAuth({ demoMode, onAuthenticated }: { demoMode: boolean; onAuthenticated: (user: SessionUser) => void }) {
  const t = useTranslate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fillDemo = () => {
    setName('Admin Demo');
    setEmail('admin@civicloop.demo');
    setPasscode(DEMO_ADMIN_PASSCODE);
  };

  const submit = () => {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('Enter your name and a valid email address.'));
      return;
    }
    if (passcode.trim().toUpperCase() !== DEMO_ADMIN_PASSCODE) {
      setError(`${t('Incorrect passcode — use the demo passcode')} ${DEMO_ADMIN_PASSCODE} ${t('in this preview.')}`);
      return;
    }
    setError(null);
    setLoading(true);
    const profile: AdminProfile = {
      id: `admin-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim(),
      email: email.trim(),
      clearance: 'super-admin',
    };
    window.setTimeout(() => onAuthenticated({ role: 'admin', profile }), 350);
  };

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('Super-admin access to the AI Brain dashboard and self-healing telemetry.')}
      </p>

      {demoMode && (
        <button
          type="button"
          onClick={fillDemo}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
        >
          <Sparkles className="h-3.5 w-3.5" /> {t('Autofill demo admin')}
        </button>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Full name')}</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Admin name')}
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Email address')}</label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="admin@civicloop.demo"
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">{t('Admin passcode')}</label>
        <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-slate-500">
          <KeyRound className="ml-3 h-4 w-4 text-slate-400" />
          <input
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder={`Demo: ${DEMO_ADMIN_PASSCODE}`}
            className="w-full rounded-xl bg-transparent px-2.5 py-2.5 text-sm uppercase tracking-wide text-slate-900 outline-none"
          />
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {t('Enter AI Brain')}
      </button>
    </div>
  );
}

export default function AuthModal({ open, onClose, onAuthenticated, demoMode = false, initialRole = 'citizen' }: AuthModalProps) {
  const t = useTranslate();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [wasOpen, setWasOpen] = useState(open);

  // Re-derived during render (not an effect) so switching tabs while the modal is
  // open doesn't get clobbered, but every fresh open still starts on `initialRole`.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRole(initialRole);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
      <div className="soft-scrollbar max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-white/70 bg-white shadow-[0_28px_100px_-24px_rgb(2_6_23_/55%)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{t('Welcome to Civicloop')}</p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">{t('Choose how you’ll take part')}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.role}
              type="button"
              onClick={() => setRole(tab.role)}
              aria-pressed={role === tab.role}
              className={cn(
                'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition',
                role === tab.role ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )}
            >
              <tab.icon className="h-3.5 w-3.5" /> {t(tab.label)}
            </button>
          ))}
        </div>

        <div className="p-5">
          {role === 'citizen' && <CitizenAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
          {role === 'volunteer' && <CoVAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
          {role === 'admin' && <AdminAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
        </div>
      </div>
    </div>
  );
}
