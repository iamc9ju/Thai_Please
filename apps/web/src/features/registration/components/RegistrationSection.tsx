import type { ReactNode } from 'react';

type RegistrationSectionProps = Readonly<{
  children: ReactNode;
  description: string;
  icon: ReactNode;
  step: string;
  title: string;
}>;

export function RegistrationSection({
  children,
  description,
  icon,
  step,
  title,
}: RegistrationSectionProps) {
  return (
    <section className="registration-section rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
      <div className="registration-section-heading flex items-start sm:items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <span
          aria-hidden="true"
          className="registration-section-icon flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3] border border-blue-100/80"
        >
          {icon}
        </span>
        <div className="space-y-0.5">
          <small className="block text-xs font-extrabold uppercase tracking-wider text-[#0056b3]">
            {step}
          </small>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0f172a] tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
