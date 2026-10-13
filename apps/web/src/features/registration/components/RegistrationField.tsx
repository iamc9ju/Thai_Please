import type { ReactNode } from 'react';
import { th } from '../../../i18n/th';
import type { RegistrationErrorCode } from '../registration.validation';

type RegistrationFieldProps = Readonly<{
  children: ReactNode;
  error?: RegistrationErrorCode | undefined;
  label: string;
  name: string;
  optional?: boolean;
}>;

export function RegistrationField({
  children,
  error,
  label,
  name,
  optional = false,
}: RegistrationFieldProps) {
  return (
    <div className="registration-field">
      <label htmlFor={name}>
        {label}
        {optional ? (
          <small>{th.registration.optional}</small>
        ) : (
          <span aria-hidden="true">*</span>
        )}
      </label>
      {children}
      {error ? (
        <p className="registration-error" id={`${name}-error`}>
          {th.registration.validation[error]}
        </p>
      ) : null}
    </div>
  );
}
