import {
  isMerchantBusinessType,
  type MerchantBusinessType,
} from '@thai-please/contracts';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  IdCard,
  KeyRound,
  Loader2,
  MapPinHouse,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { th } from '../../../i18n/th';
import { registerConsumer, registerMerchant } from '../../auth/api/auth.api';
import type { RegisterMerchantPayload } from '../../auth/auth.types';
import { MerchantTypeMultiSelect } from '../components/MerchantTypeMultiSelect';
import { RegistrationField as Field } from '../components/RegistrationField';
import { RegistrationSection } from '../components/RegistrationSection';
import { ThaiAddressCascadeFields } from '../components/ThaiAddressCascadeFields';
import {
  getBangkokDateInputValue,
  isValidBirthDate,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationRole,
} from '../registration.validation';

type RegistrationPageProps = Readonly<{
  initialRole: RegistrationRole;
  onBack: () => void;
}>;

function getAccessibilityProps(name: string, errors: RegistrationErrors) {
  const hasError = Boolean(errors[name]);

  return {
    'aria-describedby': hasError ? `${name}-error` : undefined,
    'aria-invalid': hasError,
  } as const;
}

function digitsOnly(value: string, maximumLength: number) {
  return value.replace(/\D/g, '').slice(0, maximumLength);
}

function getFormText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function getFormCheckbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true';
}

function getFormTexts(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getMerchantBusinessTypes(formData: FormData): MerchantBusinessType[] {
  return getFormTexts(formData, 'merchantTypes').filter(isMerchantBusinessType);
}

export function RegistrationPage({
  initialRole,
  onBack,
}: RegistrationPageProps) {
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [isReadyForApi, setIsReadyForApi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedMerchantTypes, setSelectedMerchantTypes] = useState<
    MerchantBusinessType[]
  >([]);
  const [registeredInfo, setRegisteredInfo] = useState<{
    fullName?: string;
    citizenId?: string;
    merchantName?: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const maximumBirthDate = getBangkokDateInputValue();

  const handleRoleChange = (nextRole: RegistrationRole) => {
    setRole(nextRole);
    setErrors({});
    setSubmitError(null);
    setIsReadyForApi(false);
    setRegisteredInfo(null);
    setSelectedMerchantTypes([]);
  };

  const handleFormChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const fieldName = target.name;
    if (!fieldName || !errors[fieldName]) {
      return;
    }

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const clearFieldErrors = (fields: string[]) => {
    setErrors((currentErrors) => {
      let hasChange = false;
      const nextErrors = { ...currentErrors };
      for (const fieldName of fields) {
        if (nextErrors[fieldName]) {
          delete nextErrors[fieldName];
          hasChange = true;
        }
      }
      return hasChange ? nextErrors : currentErrors;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextErrors = validateRegistration(formData, role);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalidField = Object.keys(nextErrors)[0];
      if (!firstInvalidField) {
        return;
      }

      requestAnimationFrame(() => {
        const field = formRef.current?.elements.namedItem(firstInvalidField);
        if (field instanceof HTMLElement) {
          field.focus();
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const fieldElement = formRef.current?.querySelector<HTMLElement>(
            `#${firstInvalidField}`,
          );
          fieldElement?.focus();
          fieldElement?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      });
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const basePayload = {
        citizenId: getFormText(formData, 'citizenId'),
        title: getFormText(formData, 'title'),
        firstName: getFormText(formData, 'firstName'),
        lastName: getFormText(formData, 'lastName'),
        birthDate: getFormText(formData, 'birthDate'),
        phone: getFormText(formData, 'phone'),
        homeNumber: getFormText(formData, 'homeNumber'),
        village: getFormText(formData, 'village') || undefined,
        building: getFormText(formData, 'building') || undefined,
        floor: getFormText(formData, 'floor') || undefined,
        room: getFormText(formData, 'room') || undefined,
        alley: getFormText(formData, 'alley') || undefined,
        road: getFormText(formData, 'road') || undefined,
        subdistrict: getFormText(formData, 'subdistrict'),
        district: getFormText(formData, 'district'),
        province: getFormText(formData, 'province'),
        postalCode: getFormText(formData, 'postalCode'),
        password: getFormText(formData, 'password'),
        acceptTerms: getFormCheckbox(formData, 'acceptTerms'),
        acceptPrivacy: getFormCheckbox(formData, 'acceptPrivacy'),
      };

      if (role === 'consumer') {
        const res = await registerConsumer(basePayload);
        setRegisteredInfo({ fullName: res.fullName, citizenId: res.citizenId });
      } else {
        const merchantPayload: RegisterMerchantPayload = {
          ...basePayload,
          merchantName: getFormText(formData, 'merchantName'),
          merchantTypes: getMerchantBusinessTypes(formData),
          taxId: getFormText(formData, 'taxId') || undefined,
          merchantPhone: getFormText(formData, 'merchantPhone'),
          merchantDescription: getFormText(formData, 'merchantDescription'),
          merchantAddress: getFormText(formData, 'merchantAddress'),
          merchantSubdistrict: getFormText(formData, 'merchantSubdistrict'),
          merchantDistrict: getFormText(formData, 'merchantDistrict'),
          merchantProvince: getFormText(formData, 'merchantProvince'),
          merchantPostalCode: getFormText(formData, 'merchantPostalCode'),
          acceptMerchantTerms: getFormCheckbox(formData, 'acceptMerchantTerms'),
        };
        const res = await registerMerchant(merchantPayload);
        setRegisteredInfo({ merchantName: res.merchantName });
      }

      setIsReadyForApi(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError(th.registration.submitError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isReadyForApi) {
    return (
      <main className="registration-page registration-success-page min-h-screen bg-slate-50/60 text-slate-900 font-sans flex flex-col">
        <header className="sticky top-0 z-30 w-full border-b border-slate-100 bg-white">
          <div className="mx-auto flex min-h-[4.75rem] sm:min-h-[5.5rem] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/images/brand-logo.png"
                alt={th.brand}
                className="h-12 sm:h-16 w-auto object-contain"
              />
            </div>
            <button
              onClick={onBack}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all cursor-pointer"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>{th.registration.backToLogin}</span>
            </button>
          </div>
        </header>
        <section
          className="registration-success my-auto mx-auto w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-sm text-center"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-[#0056b3] border border-blue-100"
          >
            <CheckCircle2 className="size-8" />
          </span>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0056b3]">
            {th.registration.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
            {th.registration.success.title}
          </h1>
          <strong className="mt-2 block text-sm text-slate-600 font-medium leading-relaxed">
            {th.registration.success[role]}
          </strong>
          {registeredInfo?.fullName ? (
            <p className="registration-success-detail mt-4 text-sm text-slate-600">
              {th.registration.success.registeredPerson}:{' '}
              <strong className="font-bold text-[#0f172a]">
                {registeredInfo.fullName}
              </strong>
            </p>
          ) : null}
          {registeredInfo?.merchantName ? (
            <p className="registration-success-detail mt-4 text-sm text-slate-600">
              {th.registration.success.registeredMerchant}:{' '}
              <strong className="font-bold text-[#0f172a]">
                {registeredInfo.merchantName}
              </strong>
            </p>
          ) : null}
          <small className="mt-4 block rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs font-medium text-[#0056b3]">
            {th.registration.success.note}
          </small>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsReadyForApi(false)}
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {th.registration.success.edit}
            </button>
            <button
              className="is-primary rounded-xl bg-[#0056b3] px-4 py-3 text-sm font-bold text-white shadow-xs hover:bg-[#004494] transition-colors cursor-pointer"
              onClick={onBack}
              type="button"
            >
              {th.registration.success.login}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-page min-h-screen bg-slate-50/60 text-slate-900 font-sans">
      <header className="sticky top-0 z-30 w-full border-b border-slate-100 bg-white/98 shadow-xs backdrop-blur-xs">
        <div className="mx-auto flex min-h-[4.75rem] sm:min-h-[5.5rem] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
          <a
            className="flex items-center gap-2 shrink-0 transition-transform duration-200 hover:scale-[1.02]"
            href="#registration-top"
            aria-label={th.brand}
          >
            <img
              src="/images/brand-logo.png"
              alt={th.brand}
              className="h-12 sm:h-16 w-auto object-contain"
            />
          </a>
          <button
            onClick={onBack}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all cursor-pointer"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>{th.registration.backToLogin}</span>
          </button>
        </div>
      </header>

      <div
        className="registration-content mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
        id="registration-top"
      >
        <section className="registration-intro flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1 text-xs font-bold text-[#0056b3]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>{th.registration.eyebrow}</span>
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0f172a] tracking-tight">
              {th.registration.title[role]}
            </h1>
            <span className="block max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
              {th.registration.description[role]}
            </span>
          </div>

          <div
            className="registration-role-switch grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xs w-full sm:w-80 shrink-0"
            aria-label={th.registration.roleLabel}
          >
            {(['consumer', 'merchant'] as const).map((registrationRole) => {
              const Icon = registrationRole === 'consumer' ? User : Store;
              const isActive = role === registrationRole;

              return (
                <button
                  aria-pressed={isActive}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'is-active bg-[#0056b3] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  key={registrationRole}
                  onClick={() => handleRoleChange(registrationRole)}
                  type="button"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{th.registration.roles[registrationRole]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="existing-identity-note my-6 flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/60 px-4 py-3.5 text-xs sm:text-sm text-slate-700">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#0056b3] border border-blue-100 shadow-2xs">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </div>
          <p className="font-medium leading-relaxed">
            {th.registration.existingIdentity}
          </p>
        </aside>

        <form
          className="registration-form space-y-6"
          key={role}
          noValidate
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <RegistrationSection
            description={th.registration.sections.identity.description}
            icon={<IdCard className="size-6" />}
            step={th.registration.sections.identity.step}
            title={th.registration.sections.identity.title}
          >
            <div className="registration-grid registration-grid-three">
              <Field
                error={errors.citizenId}
                label={th.registration.fields.citizenId}
                name="citizenId"
              >
                <input
                  {...getAccessibilityProps('citizenId', errors)}
                  autoComplete="username"
                  id="citizenId"
                  inputMode="numeric"
                  maxLength={13}
                  name="citizenId"
                  onInput={(event) => {
                    event.currentTarget.value = digitsOnly(
                      event.currentTarget.value,
                      13,
                    );
                  }}
                  placeholder={th.registration.placeholders.citizenId}
                />
              </Field>
              <Field
                error={errors.title}
                label={th.registration.fields.title}
                name="title"
              >
                <div className="relative">
                  <select
                    {...getAccessibilityProps('title', errors)}
                    id="title"
                    name="title"
                    className="w-full appearance-none pr-10"
                  >
                    <option value="">
                      {th.registration.placeholders.selectTitle}
                    </option>
                    {th.registration.titles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"
                  />
                </div>
              </Field>
              <Field
                error={errors.birthDate}
                label={th.registration.fields.birthDate}
                name="birthDate"
              >
                <input
                  {...getAccessibilityProps('birthDate', errors)}
                  autoComplete="bday"
                  id="birthDate"
                  max={maximumBirthDate}
                  name="birthDate"
                  onBlur={(event) => {
                    if (
                      event.currentTarget.value &&
                      !isValidBirthDate(event.currentTarget.value)
                    ) {
                      setErrors((currentErrors) => ({
                        ...currentErrors,
                        birthDate: 'birthDate',
                      }));
                    }
                  }}
                  type="date"
                />
              </Field>
              <Field
                error={errors.firstName}
                label={th.registration.fields.firstName}
                name="firstName"
              >
                <input
                  {...getAccessibilityProps('firstName', errors)}
                  autoComplete="given-name"
                  id="firstName"
                  name="firstName"
                />
              </Field>
              <Field
                error={errors.lastName}
                label={th.registration.fields.lastName}
                name="lastName"
              >
                <input
                  {...getAccessibilityProps('lastName', errors)}
                  autoComplete="family-name"
                  id="lastName"
                  name="lastName"
                />
              </Field>
              <Field
                error={errors.phone}
                label={th.registration.fields.phone}
                name="phone"
              >
                <input
                  {...getAccessibilityProps('phone', errors)}
                  autoComplete="tel"
                  id="phone"
                  inputMode="tel"
                  maxLength={10}
                  name="phone"
                  onInput={(event) => {
                    event.currentTarget.value = digitsOnly(
                      event.currentTarget.value,
                      10,
                    );
                  }}
                  placeholder={th.registration.placeholders.phone}
                />
              </Field>
            </div>
          </RegistrationSection>

          <RegistrationSection
            description={th.registration.sections.address.description}
            icon={<MapPinHouse className="size-6" />}
            step={th.registration.sections.address.step}
            title={th.registration.sections.address.title}
          >
            <div className="registration-grid registration-grid-address">
              <Field
                error={errors.homeNumber}
                label={th.registration.fields.homeNumber}
                name="homeNumber"
              >
                <input
                  {...getAccessibilityProps('homeNumber', errors)}
                  id="homeNumber"
                  name="homeNumber"
                />
              </Field>
              <Field
                label={th.registration.fields.village}
                name="village"
                optional
              >
                <input id="village" name="village" />
              </Field>
              <Field
                label={th.registration.fields.building}
                name="building"
                optional
              >
                <input id="building" name="building" />
              </Field>
              <Field label={th.registration.fields.floor} name="floor" optional>
                <input id="floor" name="floor" />
              </Field>
              <Field label={th.registration.fields.room} name="room" optional>
                <input id="room" name="room" />
              </Field>
              <Field label={th.registration.fields.alley} name="alley" optional>
                <input id="alley" name="alley" />
              </Field>
              <Field label={th.registration.fields.road} name="road" optional>
                <input id="road" name="road" />
              </Field>
              <ThaiAddressCascadeFields
                errors={errors}
                fieldNames={{
                  province: 'province',
                  district: 'district',
                  subdistrict: 'subdistrict',
                  postalCode: 'postalCode',
                }}
                onClearFieldErrors={clearFieldErrors}
              />
            </div>
          </RegistrationSection>

          <RegistrationSection
            description={th.registration.sections.account.description}
            icon={<KeyRound className="size-6" />}
            step={th.registration.sections.account.step}
            title={th.registration.sections.account.title}
          >
            <div className="registration-grid registration-grid-two">
              <Field
                error={errors.password}
                label={th.registration.fields.password}
                name="password"
              >
                <input
                  {...getAccessibilityProps('password', errors)}
                  autoComplete="new-password"
                  id="password"
                  name="password"
                  placeholder={th.registration.placeholders.password}
                  type="password"
                />
              </Field>
              <Field
                error={errors.confirmPassword}
                label={th.registration.fields.confirmPassword}
                name="confirmPassword"
              >
                <input
                  {...getAccessibilityProps('confirmPassword', errors)}
                  autoComplete="new-password"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                />
              </Field>
            </div>
            <div className="password-rule-card mt-4 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0056b3] border border-blue-100">
                <BadgeCheck className="size-4.5" aria-hidden="true" />
              </div>
              <p className="space-y-0.5">
                <strong className="block text-xs sm:text-sm font-bold text-[#0f172a]">
                  {th.registration.passwordRules.title}
                </strong>
                <span className="block text-xs text-slate-600 leading-relaxed">
                  {th.registration.passwordRules.detail}
                </span>
              </p>
            </div>
          </RegistrationSection>

          {role === 'merchant' ? (
            <RegistrationSection
              description={th.registration.sections.merchant.description}
              icon={<Building2 className="size-6" />}
              step={th.registration.sections.merchant.step}
              title={th.registration.sections.merchant.title}
            >
              <div className="registration-grid registration-grid-two">
                <Field
                  error={errors.merchantName}
                  label={th.registration.fields.merchantName}
                  name="merchantName"
                >
                  <input
                    {...getAccessibilityProps('merchantName', errors)}
                    id="merchantName"
                    name="merchantName"
                  />
                </Field>
                <Field
                  error={errors.merchantTypes}
                  label={th.registration.fields.merchantTypes}
                  name="merchantTypes"
                >
                  <MerchantTypeMultiSelect
                    options={th.registration.merchantTypes}
                    selectedValues={selectedMerchantTypes}
                    placeholder={
                      th.registration.placeholders.selectMerchantTypes
                    }
                    groupLabel={th.registration.merchantTypesGroupLabel}
                    selectedCountText={th.registration.merchantTypesSelected}
                    removeLabel={th.registration.removeMerchantType}
                    hasError={Boolean(errors.merchantTypes)}
                    onChange={setSelectedMerchantTypes}
                  />
                </Field>
                <Field
                  label={th.registration.fields.taxId}
                  name="taxId"
                  optional
                  error={errors.taxId}
                >
                  <input
                    {...getAccessibilityProps('taxId', errors)}
                    id="taxId"
                    inputMode="numeric"
                    maxLength={13}
                    name="taxId"
                    onInput={(event) => {
                      event.currentTarget.value = digitsOnly(
                        event.currentTarget.value,
                        13,
                      );
                    }}
                  />
                </Field>
                <Field
                  error={errors.merchantPhone}
                  label={th.registration.fields.merchantPhone}
                  name="merchantPhone"
                >
                  <input
                    {...getAccessibilityProps('merchantPhone', errors)}
                    id="merchantPhone"
                    inputMode="tel"
                    maxLength={10}
                    name="merchantPhone"
                    onInput={(event) => {
                      event.currentTarget.value = digitsOnly(
                        event.currentTarget.value,
                        10,
                      );
                    }}
                    placeholder={th.registration.placeholders.phone}
                  />
                </Field>
                <div className="registration-field-wide">
                  <Field
                    error={errors.merchantDescription}
                    label={th.registration.fields.merchantDescription}
                    name="merchantDescription"
                  >
                    <textarea
                      {...getAccessibilityProps('merchantDescription', errors)}
                      id="merchantDescription"
                      name="merchantDescription"
                      placeholder={
                        th.registration.placeholders.merchantDescription
                      }
                      rows={3}
                    />
                  </Field>
                </div>
                <div className="registration-field-wide">
                  <Field
                    error={errors.merchantAddress}
                    label={th.registration.fields.merchantAddress}
                    name="merchantAddress"
                  >
                    <textarea
                      {...getAccessibilityProps('merchantAddress', errors)}
                      id="merchantAddress"
                      name="merchantAddress"
                      rows={2}
                    />
                  </Field>
                </div>
                <ThaiAddressCascadeFields
                  errors={errors}
                  fieldNames={{
                    province: 'merchantProvince',
                    district: 'merchantDistrict',
                    subdistrict: 'merchantSubdistrict',
                    postalCode: 'merchantPostalCode',
                  }}
                  onClearFieldErrors={clearFieldErrors}
                />
              </div>
            </RegistrationSection>
          ) : null}

          <section className="registration-consent rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs space-y-3">
            <label className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer">
              <input
                name="acceptTerms"
                type="checkbox"
                className="size-4.5 rounded border-slate-300 accent-[#0056b3] cursor-pointer"
              />
              <span>{th.registration.consent.terms}</span>
            </label>
            {errors.acceptTerms ? (
              <p className="registration-error text-xs font-semibold text-rose-600 pl-7">
                {th.registration.validation.acceptTerms}
              </p>
            ) : null}
            <label className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer">
              <input
                name="acceptPrivacy"
                type="checkbox"
                className="size-4.5 rounded border-slate-300 accent-[#0056b3] cursor-pointer"
              />
              <span>{th.registration.consent.privacy}</span>
            </label>
            {errors.acceptPrivacy ? (
              <p className="registration-error text-xs font-semibold text-rose-600 pl-7">
                {th.registration.validation.acceptPrivacy}
              </p>
            ) : null}
            {role === 'merchant' ? (
              <>
                <label className="flex items-center gap-3 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer">
                  <input
                    name="acceptMerchantTerms"
                    type="checkbox"
                    className="size-4.5 rounded border-slate-300 accent-[#0056b3] cursor-pointer"
                  />
                  <span>{th.registration.consent.merchantTerms}</span>
                </label>
                {errors.acceptMerchantTerms ? (
                  <p className="registration-error text-xs font-semibold text-rose-600 pl-7">
                    {th.registration.validation.acceptMerchantTerms}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <footer className="registration-submit-bar rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <small className="block text-xs sm:text-sm font-medium text-slate-500">
                {th.registration.requiredHint}
              </small>
              {submitError ? (
                <p
                  aria-live="assertive"
                  className="registration-error mt-1 text-xs sm:text-sm font-bold text-rose-600"
                >
                  {submitError}
                </p>
              ) : null}
              {Object.keys(errors).length > 0 ? (
                <p
                  aria-live="assertive"
                  className="mt-1 text-xs sm:text-sm font-bold text-rose-600"
                >
                  {th.registration.validation.summary}
                </p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#0056b3] px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-xs hover:bg-[#004494] active:scale-98 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  <span>กำลังดำเนินการ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                  <span>{th.registration.submit[role]}</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
