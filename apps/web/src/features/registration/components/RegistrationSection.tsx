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
    <section className="registration-section">
      <div className="registration-section-heading">
        <span aria-hidden="true" className="registration-section-icon">
          {icon}
        </span>
        <div>
          <small>{step}</small>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
