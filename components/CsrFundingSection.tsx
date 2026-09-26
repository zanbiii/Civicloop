'use client';

import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  CircleCheckBig,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  GitMerge,
  Handshake,
  HardHat,
  Images,
  IndianRupee,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  Link2,
  MapPin,
  Plug,
  Radar,
  Repeat,
  Route,
  ScanSearch,
  Server,
  ThumbsUp,
  Timer,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react';
import { useTranslate } from '@/components/AppLanguageProvider';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------------- */
/* Content                                                                   */
/* ------------------------------------------------------------------------- */

type Icon = typeof Building2;

const FLOW_PHASES: Array<{ phase: string; caption: string; steps: Array<{ icon: Icon; label: string }> }> = [
  {
    phase: 'Fund',
    caption: 'The company directs part of its CSR budget to a civic program.',
    steps: [
      { icon: Building2, label: 'MNC / CSR-eligible company' },
      { icon: IndianRupee, label: 'CSR Budget' },
      { icon: Handshake, label: 'Civicloop Civic Impact Program' },
    ],
  },
  {
    phase: 'Identify',
    caption: 'Real civic needs are captured, cleaned up and prioritized.',
    steps: [
      { icon: Users, label: 'Citizen Reports / Identified Civic Projects' },
      { icon: BrainCircuit, label: 'AI Classification' },
      { icon: GitMerge, label: 'Location + Duplicate Detection' },
      { icon: Route, label: 'Prioritization + Smart Routing' },
    ],
  },
  {
    phase: 'Deliver',
    caption: 'Existing teams do the work, with deadlines tracked live.',
    steps: [
      { icon: HardHat, label: 'Existing Municipal / Implementation Team' },
      { icon: Timer, label: 'SLA Monitoring' },
      { icon: CircleCheckBig, label: 'Project Completed' },
    ],
  },
  {
    phase: 'Prove',
    caption: 'Outcomes are evidenced, verified and confirmed by citizens.',
    steps: [
      { icon: Images, label: 'Before / After Evidence' },
      { icon: BadgeCheck, label: 'Verification' },
      { icon: ThumbsUp, label: 'Citizen Confirmation' },
      { icon: LayoutDashboard, label: 'CSR Impact Dashboard' },
    ],
  },
];

/** Number of steps before each phase, so steps are numbered 1–14 across the whole flow. */
const PHASE_STEP_OFFSETS = FLOW_PHASES.map((_, index) =>
  FLOW_PHASES.slice(0, index).reduce((total, phase) => total + phase.steps.length, 0),
);

const MONITORED_FIELDS: Array<{ icon: Icon; label: string }> = [
  { icon: Layers, label: 'Projects funded' },
  { icon: IndianRupee, label: 'Amount allocated' },
  { icon: MapPin, label: 'Geographic locations' },
  { icon: ScanSearch, label: 'Civic issues addressed' },
  { icon: Users, label: 'Citizens reached' },
  { icon: Workflow, label: 'Project status' },
  { icon: Timer, label: 'Resolution time' },
  { icon: Gauge, label: 'SLA performance' },
  { icon: Images, label: 'Before/after evidence' },
  { icon: BadgeCheck, label: 'Verification status' },
  { icon: TrendingUp, label: 'Overall impact metrics' },
];

const REASONS: Array<{ icon: Icon; title: string; body: string }> = [
  { icon: Eye, title: 'Transparent CSR project tracking', body: 'Follow each supported project from allocation to closure.' },
  { icon: BadgeCheck, title: 'Evidence-based verification', body: 'Closure needs before/after photo proof and citizen sign-off.' },
  { icon: LayoutDashboard, title: 'Real-time impact dashboards', body: 'Status, SLA and outcomes update as work progresses.' },
  { icon: MapPin, title: 'Geographic visibility', body: 'See where supported work is happening on a live map.' },
  { icon: GitMerge, title: 'Reduced duplicate reporting', body: 'Nearby reports of one issue merge into a single project.' },
  { icon: Radar, title: 'Centralized monitoring', body: 'One view across wards, departments and partners.' },
  { icon: Link2, title: 'Clear funding-to-outcome traceability', body: 'Link each allocation to the work and evidence it produced.' },
  { icon: FileText, title: 'Easier CSR impact reporting', body: 'Structured project records to draw on for impact reports.' },
];

const REVENUE_STREAMS: Array<{ icon: Icon; label: string }> = [
  { icon: Repeat, label: 'Software subscriptions' },
  { icon: Server, label: 'Enterprise deployments' },
  { icon: Plug, label: 'Integrations' },
  { icon: Wrench, label: 'Implementation services' },
  { icon: ClipboardList, label: 'Eligible program-management services' },
];

/* ------------------------------------------------------------------------- */
/* Pieces                                                                    */
/* ------------------------------------------------------------------------- */

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl space-y-1.5">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</div>
      <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h3>
      {subtitle && <p className="text-sm leading-6 text-slate-600">{subtitle}</p>}
    </div>
  );
}

function FlowConnector() {
  return (
    <div aria-hidden="true" className="flex justify-center text-slate-400 sm:hidden lg:flex lg:items-center">
      <ArrowDown className="h-5 w-5 lg:hidden" />
      <ArrowRight className="hidden h-5 w-5 lg:block" />
    </div>
  );
}

function FundingFlow() {
  const t = useTranslate();
  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow={t('Funding → Impact')}
        title={t('From CSR budget to citizen-confirmed outcome')}
        subtitle={t('Every rupee a company chooses to route through a civic program follows the same traceable path.')}
      />
      <ol className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-2">
        {FLOW_PHASES.map((phase, phaseIndex) => (
          <li key={phase.phase} className="contents">
            {phaseIndex > 0 && <FlowConnector />}
            <div className="surface-card flex flex-col p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-bold text-emerald-700">0{phaseIndex + 1}</span>
                <span className="text-sm font-bold uppercase tracking-wide text-slate-900">{t(phase.phase)}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{t(phase.caption)}</p>
              <ol className="mt-3 flex flex-1 flex-col">
                {phase.steps.map((step, stepIndex) => {
                  const stepNumber = PHASE_STEP_OFFSETS[phaseIndex] + stepIndex + 1;
                  const isFinal = phaseIndex === FLOW_PHASES.length - 1 && stepIndex === phase.steps.length - 1;
                  return (
                    <li key={step.label} className="flex flex-col">
                      {stepIndex > 0 && (
                        <span aria-hidden="true" className="flex justify-center py-0.5 text-slate-400">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border px-3 py-2.5',
                          isFinal ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                            isFinal ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700',
                          )}
                        >
                          <step.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className={cn('text-xs font-semibold leading-snug', isFinal ? 'text-emerald-800' : 'text-slate-800')}>
                          {t(step.label)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{stepNumber}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IllustrativeExample() {
  const t = useTranslate();
  return (
    <div className="surface-card flex flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{t('How the 2% is calculated')}</h3>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
          {t('Example · Illustrative only')}
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">{t('Average eligible net profit (3 preceding financial years)')}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">₹100 {t('crore')}</div>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
          <ArrowDown className="h-4 w-4" /> × 2%
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-emerald-700">{t('Illustrative CSR amount at 2%')}</div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-emerald-800">₹2 {t('crore')}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {t(
            "This ₹2 crore is the company's illustrative CSR obligation. It is NOT automatically paid to Civicloop. The company decides which eligible projects and implementing partners to support; Civicloop tracks the projects it chooses to run through the platform.",
          )}
        </p>
      </div>
    </div>
  );
}

function MonitoringPreview() {
  const t = useTranslate();
  return (
    <div className="surface-card flex flex-col p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <LayoutDashboard className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="text-base font-bold text-slate-900">{t('What a company can monitor through Civicloop')}</h3>
          <p className="text-xs text-slate-500">{t('CSR Impact Dashboard coverage for each supported project')}</p>
        </div>
      </div>
      <ul className="mt-5 grid flex-1 grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {MONITORED_FIELDS.map((field) => (
          <li key={field.label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <field.icon className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-800">{t(field.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhyCompanies() {
  const t = useTranslate();
  return (
    <div className="space-y-5">
      <SectionHeading eyebrow={t('For CSR teams')} title={t('Why Companies Use Civicloop')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((reason) => (
          <div key={reason.title} className="surface-card group p-4 transition hover:-translate-y-0.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <reason.icon className="h-4.5 w-4.5" />
            </span>
            <h4 className="mt-3 text-sm font-bold leading-snug text-slate-900">{t(reason.title)}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t(reason.body)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessModel() {
  const t = useTranslate();
  return (
    <div className="surface-card p-5 sm:p-7">
      <SectionHeading
        eyebrow={t('Business model')}
        title={t('Sustainable beyond CSR')}
        subtitle={t(
          'Civicloop is not dependent only on a percentage of CSR funding. CSR programs can be one acquisition and project-financing channel, while the platform can generate recurring revenue through software subscriptions, enterprise deployments, integrations, implementation services, and eligible program-management services.',
        )}
      />
      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)] lg:items-stretch">
        <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('Channel')}</div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Handshake className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">{t('CSR programs')}</div>
              <div className="text-xs text-slate-500">{t('Acquisition + project financing')}</div>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center justify-center text-slate-400">
          <ArrowDown className="h-5 w-5 lg:hidden" />
          <ArrowRight className="hidden h-5 w-5 lg:block" />
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t('Recurring platform revenue')}</div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {REVENUE_STREAMS.map((stream) => (
              <li
                key={stream.label}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              >
                <stream.icon className="h-3.5 w-3.5 text-emerald-700" /> {t(stream.label)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Section                                                                   */
/* ------------------------------------------------------------------------- */

export default function CsrFundingSection() {
  const t = useTranslate();
  return (
    <section id="csr-funding" aria-labelledby="csr-funding-title" className="scroll-mt-24 space-y-8 sm:space-y-10">
      <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#0c3029] px-5 py-7 text-white shadow-[0_24px_80px_-36px_rgb(6_78_59_/65%)] sm:rounded-[2rem] sm:px-9 sm:py-10 lg:px-12">
        <div className="pointer-events-none absolute -left-24 -top-36 -z-10 h-[26rem] w-[26rem] rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-[10%] -z-10 h-72 w-72 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:gap-12">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-100/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-100">
              <Building2 className="h-3.5 w-3.5 text-emerald-300" /> {t('CSR FUNDING · FOR COMPANIES')}
            </span>
            <h2 id="csr-funding-title" className="max-w-2xl text-3xl font-bold leading-[1.1] tracking-[-0.035em] text-white sm:text-4xl lg:text-[2.75rem]">
              {t('Turn CSR Spending Into')} <span className="text-emerald-300">{t('Measurable Civic Impact')}</span>
            </h2>
            <p className="max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-base">
              {t(
                'Civicloop provides a transparent technology and monitoring layer, so companies can track where supported funds are being used and what outcomes they produce, from allocation to verified, citizen-confirmed results.',
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-semibold text-emerald-50/80">
              {['Traceable', 'Evidence-backed', 'Citizen-verified'].map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" /> {t(tag)}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
                <Landmark className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">{t('The legal context')}</div>
                <div className="text-sm font-semibold text-white">{t('Section 135, Companies Act, 2013')}</div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-6 text-emerald-50/80">
              {t(
                'Eligible companies in India are generally required to spend at least 2% of the average net profits of the three immediately preceding financial years on CSR, subject to applicable rules and eligibility requirements.',
              )}
            </p>
            <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-emerald-50/60">
              {t('Civicloop does not automatically receive CSR funds. Companies choose which eligible projects and partners to support.')}
            </p>
          </div>
        </div>
      </div>

      <FundingFlow />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <IllustrativeExample />
        <MonitoringPreview />
      </div>

      <WhyCompanies />

      <BusinessModel />

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t(
          'CSR eligibility, permitted activities, implementing-agency requirements and treatment of program or administrative costs are subject to applicable Indian laws and CSR rules.',
        )}
      </p>
    </section>
  );
}
