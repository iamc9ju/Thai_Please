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
    <div className="registration-field flex flex-col">
      <label
        htmlFor={name}
        id={`${name}-label`}
        className="flex items-center gap-1.5 mb-1.5 text-xs sm:text-sm font-bold text-slate-800"
      >
        <span>{label}</span>
        {optional ? (
          <small className="ml-auto text-xs font-medium text-slate-400">
            {th.registration.optional}
          </small>
        ) : (
          <span aria-hidden="true" className="text-rose-600 font-bold">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          className="registration-error mt-1.5 text-xs font-semibold text-rose-600"
          id={`${name}-error`}
        >
          {th.registration.validation[error]}
        </p>
      ) : null}
    </div>
  );
}
