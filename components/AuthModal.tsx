'use client';

import { useId, useState } from 'react';
import { Bot, HardHat, KeyRound, LoaderCircle, Mail, Phone, ShieldCheck, Sparkles, TriangleAlert, User, X } from 'lucide-react';
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
import { useEscapeKey } from '@/lib/useEscapeKey';
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

function FormError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="field-error">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
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
  const otpId = useId();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          {t('We sent a 6-digit code to')} <span className="font-semibold text-slate-900">{destination}</span>.
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{t('This is a hackathon preview — no real SMS/email is sent.')}</p>
      </div>

      <input
        id={otpId}
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="••••••"
        aria-label={t('6-digit code')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${otpId}-error` : undefined}
        className="field px-4 py-3 text-center text-2xl font-bold tracking-[0.5em]"
      />

      <button
        type="button"
        onClick={() => setOtp(DEMO_OTP)}
        className={cn('btn btn-sm btn-block', demoMode ? 'btn-demo' : 'btn-secondary text-slate-500')}
      >
        <Sparkles className="h-3.5 w-3.5" /> {t('Auto-Fill Demo OTP')} {DEMO_OTP}
      </button>

      {error && <FormError id={`${otpId}-error`} message={error} />}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-secondary">
          {t('Back')}
        </button>
        <button
          type="button"
          disabled={otp.length !== 6 || loading}
          onClick={() => onVerify(otp)}
          className="btn btn-primary flex-1"
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
  const fieldId = useId();

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
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold" role="group" aria-label={t('Sign-in method')}>
        {([
          { id: 'phone', label: t('Phone + OTP'), icon: Phone },
          { id: 'email', label: t('Email'), icon: Mail },
        ] as const).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMethod(option.id)}
            aria-pressed={method === option.id}
            className={cn(
              'flex min-h-9 items-center justify-center gap-1.5 rounded-lg transition duration-150 active:scale-[0.98]',
              method === option.id
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-[#f1f5f3]',
            )}
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden="true" /> {option.label}
          </button>
        ))}
      </div>

      {method === 'phone' ? (
        <div className="animate-fade-in">
          <label htmlFor={fieldId} className="field-label">{t('Mobile number')}</label>
          <div className="field-group">
            <span className="pl-3.5 text-sm font-medium text-slate-400">+91</span>
            <input
              id={fieldId}
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98451 20337"
              aria-invalid={Boolean(error)}
              className="w-full rounded-xl bg-transparent px-2 py-3 text-sm outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <label htmlFor={fieldId} className="field-label">{t('Email address')}</label>
          <input
            id={fieldId}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(error)}
            className="field py-3"
          />
        </div>
      )}

      <p className="flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-700">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('Your number and identity are never shown publicly — only your issue and its location reach CoVs.')}
      </p>

      {error && <FormError message={error} />}

      <button type="button" onClick={sendOtp} className="btn btn-primary btn-block">
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
  const ids = useId();
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
          className="btn btn-demo btn-sm btn-block"
        >
          <Sparkles className="h-3.5 w-3.5" /> {t('Autofill a demo CoV (PWD/Roads, Koramangala)')}
        </button>
      )}

      <div>
        <label htmlFor={`${ids}-name`} className="field-label">{t('Full name')}</label>
        <input
          id={`${ids}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Full name')}
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${ids}-cov`} className="field-label">{t('CoV ID')}</label>
          <input
            id={`${ids}-cov`}
            value={covId}
            onChange={(event) => setCovId(event.target.value)}
            placeholder="COV-KOR-114"
            className="field"
          />
        </div>
        <div>
          <label htmlFor={`${ids}-phone`} className="field-label">{t('Mobile number')}</label>
          <input
            id={`${ids}-phone`}
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            placeholder="9900112233"
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${ids}-upi`} className="field-label">{t('UPI ID for bounty payouts')}</label>
        <input
          id={`${ids}-upi`}
          value={upiId}
          onChange={(event) => setUpiId(event.target.value)}
          placeholder="name@bank"
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${ids}-dept`} className="field-label">{t('Department')}</label>
          <select
            id={`${ids}-dept`}
            value={department}
            onChange={(event) => setDepartment(event.target.value as Department)}
            className="field px-3"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${ids}-zone`} className="field-label">{t('Zone')}</label>
          <select
            id={`${ids}-zone`}
            value={zone}
            onChange={(event) => setZone(event.target.value as (typeof ZONES)[number])}
            className="field px-3"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <FormError message={error} />}

      <button type="button" onClick={sendOtp} className="btn btn-primary btn-block">
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
  const ids = useId();
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
      <p className="flex items-start gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('Super-admin access to the AI Brain dashboard and self-healing telemetry.')}
      </p>

      {demoMode && (
        <button
          type="button"
          onClick={fillDemo}
          className="btn btn-demo btn-sm btn-block"
        >
          <Sparkles className="h-3.5 w-3.5" /> {t('Autofill demo admin')}
        </button>
      )}

      <div>
        <label htmlFor={`${ids}-name`} className="field-label">{t('Full name')}</label>
        <input
          id={`${ids}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Admin name')}
          className="field"
        />
      </div>

      <div>
        <label htmlFor={`${ids}-email`} className="field-label">{t('Email address')}</label>
        <input
          id={`${ids}-email`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="admin@civicloop.demo"
          className="field"
        />
      </div>

      <div>
        <label htmlFor={`${ids}-pass`} className="field-label">{t('Admin passcode')}</label>
        <div className="field-group">
          <KeyRound className="ml-3 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            id={`${ids}-pass`}
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder={`Demo: ${DEMO_ADMIN_PASSCODE}`}
            className="w-full rounded-xl bg-transparent px-2.5 py-2.5 text-sm uppercase tracking-wide outline-none"
          />
        </div>
      </div>

      {error && <FormError message={error} />}

      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="btn btn-primary btn-block"
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

  useEscapeKey(onClose, open);
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="modal-backdrop z-[2000] p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel soft-scrollbar max-h-[92dvh] max-w-md overflow-y-auto rounded-[1.5rem]"
      >
        <div className="modal-header px-5 py-4">
          <div>
            <p className="eyebrow text-[10px]">{t('Welcome to Civicloop')}</p>
            <h2 id={titleId} className="mt-0.5 text-base font-bold text-slate-900">{t('Choose how you’ll take part')}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon text-slate-400" aria-label={t('Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 border-b border-slate-100 px-5 py-3" role="group" aria-label={t('Choose your role')}>
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.role}
              type="button"
              onClick={() => setRole(tab.role)}
              aria-pressed={role === tab.role}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition duration-150 active:scale-[0.98]',
                role === tab.role
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-[#263631] dark:hover:text-[#f1f5f3]',
              )}
            >
              <tab.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t(tab.label)}
            </button>
          ))}
        </div>

        <div key={role} className="animate-fade-in p-5">
          {role === 'citizen' && <CitizenAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
          {role === 'volunteer' && <CoVAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
          {role === 'admin' && <AdminAuth demoMode={demoMode} onAuthenticated={onAuthenticated} />}
        </div>
      </div>
    </div>
  );
}
