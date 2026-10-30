import {
  Calendar,
  CheckCircle2,
  Coins,
  Database,
  FileCheck2,
  Gift,
  QrCode,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export interface ProjectInfoSectionProps {
  onSwitchToHowToJoin?: (() => void) | undefined;
  onRegister?: (() => void) | undefined;
}

export function ProjectInfoSection({
  onSwitchToHowToJoin,
  onRegister,
}: ProjectInfoSectionProps) {
  const t = th.projectInfoAndEligibility.projectInfo;

  return (
    <div className="w-full space-y-12 sm:space-y-16">
      {/* 1. Header & Overview Card */}
      <section
        aria-labelledby="project-info-overview-heading"
        className="relative overflow-hidden rounded-3xl bg-[#0056b3] p-6 sm:p-10 lg:p-12 text-white shadow-md"
      >
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-blue-100">
            <ShieldCheck className="size-4 text-blue-200" aria-hidden="true" />
            <span>{t.badge}</span>
          </div>

          <h1
            id="project-info-overview-heading"
            className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight"
          >
            {t.title}
          </h1>

          <p className="text-base sm:text-lg text-blue-100 leading-relaxed font-normal">
            {t.subtitle}
          </p>

          <div className="pt-2 flex flex-wrap gap-3 sm:gap-4">
            {onSwitchToHowToJoin && (
              <button
                type="button"
                onClick={onSwitchToHowToJoin}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm sm:text-base font-bold text-[#0056b3] shadow-md hover:bg-blue-50 active:scale-98 transition-all cursor-pointer"
              >
                <span>{th.projectInfoAndEligibility.tabs.howToJoin}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            )}
            {onRegister && (
              <button
                type="button"
                onClick={onRegister}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm sm:text-base font-bold text-white backdrop-blur-xs hover:bg-white/20 active:scale-98 transition-all cursor-pointer"
              >
                <span>{th.landing.actions.registerConsumer}</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background blurs */}
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 size-72 sm:size-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute right-12 -bottom-20 size-60 sm:size-80 rounded-full bg-blue-300/10 blur-2xl pointer-events-none"
        />
      </section>

      {/* 2. Key Metric / Policy Highlight Cards */}
      <section
        aria-label="สรุปสิทธิประโยชน์หลักของโครงการ"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        {/* Co-Pay 60/40 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3] mb-4">
            <Coins className="size-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t.stats.coPay.label}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
            {t.stats.coPay.value}
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {t.stats.coPay.desc}
          </p>
        </div>

        {/* Daily Limit */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3] mb-4">
            <Wallet className="size-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t.stats.dailyLimit.label}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
            {t.stats.dailyLimit.value}
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {t.stats.dailyLimit.desc}
          </p>
        </div>

        {/* Campaign Period */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
            <Calendar className="size-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t.stats.period.label}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
            {t.stats.period.value}
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {t.stats.period.desc}
          </p>
        </div>

        {/* Weekly Quests & Rewards */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
            <Gift className="size-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t.stats.quests.label}
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
            {t.stats.quests.value}
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {t.stats.quests.desc}
          </p>
        </div>
      </section>

      {/* 3. Objectives Grid */}
      <section
        aria-labelledby="project-objectives-heading"
        className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 sm:p-8 lg:p-10"
      >
        <div className="max-w-2xl mb-8">
          <h2
            id="project-objectives-heading"
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight"
          >
            {t.objectives.title}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            {t.objectives.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {t.objectives.items.map((item, index) => {
            const icons = [TrendingUp, Wallet, Store, Users];
            const Icon = icons[index % icons.length] ?? TrendingUp;
            return (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-100/80"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
                  <Icon className="size-5.5" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Architecture & Security Transparency Principles */}
      <section
        aria-labelledby="transparency-principles-heading"
        className="space-y-6"
      >
        <div className="max-w-2xl">
          <h2
            id="transparency-principles-heading"
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight"
          >
            {t.principles.title}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            {t.principles.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {t.principles.items.map((principle, index) => {
            const icons = [Database, QrCode, FileCheck2];
            const Icon = icons[index % icons.length] ?? Database;
            return (
              <div
                key={principle.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-3"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Icon className="size-5.5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {principle.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {principle.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Eligible vs Ineligible Goods & Merchants */}
      <section
        aria-labelledby="categories-heading"
        className="space-y-6"
      >
        <div className="max-w-2xl">
          <h2
            id="categories-heading"
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight"
          >
            {t.categories.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Eligible */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-6 text-[#0056b3] shrink-0" aria-hidden="true" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t.categories.eligibleTitle}
              </h3>
            </div>
            <ul className="space-y-2.5">
              {t.categories.eligibleItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#0056b3] text-xs font-bold mt-0.5">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ineligible */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5">
              <XCircle className="size-6 text-rose-600 shrink-0" aria-hidden="true" />
              <h3 className="text-base sm:text-lg font-bold text-rose-950">
                {t.categories.ineligibleTitle}
              </h3>
            </div>
            <ul className="space-y-2.5">
              {t.categories.ineligibleItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-rose-900"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xs font-bold mt-0.5">
                    ✕
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
