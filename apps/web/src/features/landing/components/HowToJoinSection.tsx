import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  LogIn,
  ShieldCheck,
  Smartphone,
  Store,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export type EligibilityRoleTab = 'consumer' | 'merchant';

export interface HowToJoinSectionProps {
  selectedRole?: EligibilityRoleTab | undefined;
  onSelectRole?: ((role: EligibilityRoleTab) => void) | undefined;
  onRegisterConsumer?: (() => void) | undefined;
  onRegisterMerchant?: (() => void) | undefined;
  onLoginConsumer?: (() => void) | undefined;
  onLoginMerchant?: (() => void) | undefined;
}

export function HowToJoinSection({
  selectedRole = 'consumer',
  onSelectRole,
  onRegisterConsumer,
  onRegisterMerchant,
  onLoginConsumer,
  onLoginMerchant,
}: HowToJoinSectionProps) {
  const t = th.projectInfoAndEligibility.howToJoin;
  const isConsumer = selectedRole === 'consumer';
  const roleData = isConsumer ? t.consumer : t.merchant;

  const handleRoleTabChange = (role: EligibilityRoleTab) => {
    onSelectRole?.(role);
  };

  return (
    <div className="w-full space-y-10 sm:space-y-12">
      {/* 1. Header & Role Selector */}
      <section
        aria-labelledby="how-to-join-heading"
        className="text-center max-w-3xl mx-auto space-y-4"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#0056b3]">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>{t.badge}</span>
        </div>

        <h1
          id="how-to-join-heading"
          className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
        >
          {t.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
          {t.subtitle}
        </p>

        {/* Segmented Control / Role Tabs */}
        <div className="pt-4 flex justify-center">
          <div
            role="tablist"
            aria-label={t.roleTabs.ariaLabel}
            className="inline-flex rounded-2xl bg-slate-100 p-1.5 shadow-inner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isConsumer}
              aria-controls="role-panel-consumer"
              id="role-tab-consumer"
              onClick={() => handleRoleTabChange('consumer')}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm sm:text-base font-bold transition-all cursor-pointer ${
                isConsumer
                  ? 'bg-white text-[#0056b3] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="size-4.5" aria-hidden="true" />
              <span>{t.roleTabs.consumer}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={!isConsumer}
              aria-controls="role-panel-merchant"
              id="role-tab-merchant"
              onClick={() => handleRoleTabChange('merchant')}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm sm:text-base font-bold transition-all cursor-pointer ${
                !isConsumer
                  ? 'bg-white text-[#0056b3] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="size-4.5" aria-hidden="true" />
              <span>{t.roleTabs.merchant}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Active Role Content Panel */}
      <div
        role="tabpanel"
        id={isConsumer ? 'role-panel-consumer' : 'role-panel-merchant'}
        aria-labelledby={isConsumer ? 'role-tab-consumer' : 'role-tab-merchant'}
        className="space-y-10 sm:space-y-12 animate-in fade-in duration-200"
      >
        {/* Banner with Title and Description */}
        <div
          className={`rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-lg ${
            isConsumer
              ? 'bg-gradient-to-r from-[#0056b3] to-[#0080ff]'
              : 'bg-gradient-to-r from-[#004d40] to-[#00897b]'
          }`}
        >
          <div className="max-w-3xl space-y-3">
            <span className="inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
              {isConsumer ? 'สำหรับบุคคลทั่วไป' : 'สำหรับผู้ประกอบการ'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {roleData.title}
            </h2>
            <p className="text-sm sm:text-base text-blue-50/90 leading-relaxed">
              {roleData.description}
            </p>
          </div>
        </div>

        {/* Eligibility & Preparation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Eligibility Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3]">
                <UserCheck className="size-5" aria-hidden="true" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {roleData.eligibilityTitle}
              </h3>
            </div>
            <ul className="space-y-3">
              {roleData.eligibilityItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-xs sm:text-sm text-slate-700"
                >
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Preparation Checklist Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {isConsumer ? (
                  <Smartphone className="size-5" aria-hidden="true" />
                ) : (
                  <FileText className="size-5" aria-hidden="true" />
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {roleData.preparationTitle}
              </h3>
            </div>
            <ul className="space-y-3">
              {roleData.preparationItems.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-xs sm:text-sm text-slate-700"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mt-0.5">
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4-Step Visual Flow */}
        <section aria-labelledby="steps-flow-heading" className="space-y-6">
          <div className="max-w-2xl">
            <h3
              id="steps-flow-heading"
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
            >
              {roleData.stepsTitle}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {roleData.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="relative rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-xl bg-[#0056b3] text-white font-extrabold text-base shadow-xs"
                    >
                      {step.stepNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      ขั้นตอนที่ {step.stepNumber}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mb-2">
                    {step.title}
                  </h4>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Important Notes Box */}
        <section
          aria-labelledby="important-notes-heading"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 space-y-3"
        >
          <div className="flex items-center gap-2.5 text-amber-900">
            <AlertCircle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <h4
              id="important-notes-heading"
              className="font-bold text-sm sm:text-base text-amber-950"
            >
              {roleData.importantNotesTitle}
            </h4>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-amber-900/90 pl-7 list-disc">
            {roleData.importantNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        {/* Action Call To Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              if (isConsumer) {
                onRegisterConsumer?.();
              } else {
                onRegisterMerchant?.();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#0056b3] px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-md hover:bg-[#004494] active:scale-98 transition-all cursor-pointer"
          >
            <UserPlus className="size-5" aria-hidden="true" />
            <span>{roleData.ctaPrimary}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isConsumer) {
                onLoginConsumer?.();
              } else {
                onLoginMerchant?.();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm sm:text-base font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all cursor-pointer"
          >
            <LogIn className="size-5 text-slate-500" aria-hidden="true" />
            <span>{roleData.ctaSecondary}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
