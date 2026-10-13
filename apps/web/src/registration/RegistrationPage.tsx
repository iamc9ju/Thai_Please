import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  HandHeart,
  IdCard,
  KeyRound,
  MapPinHouse,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { th } from '../i18n/th';
import {
  validateRegistration,
  type RegistrationErrorCode,
  type RegistrationErrors,
  type RegistrationRole,
} from './registration.validation';

type RegistrationPageProps = Readonly<{
  initialRole: RegistrationRole;
  onBack: () => void;
}>;

type FieldProps = Readonly<{
  children: ReactNode;
  error?: RegistrationErrorCode | undefined;
  label: string;
  name: string;
  optional?: boolean;
}>;

type SectionProps = Readonly<{
  children: ReactNode;
  description: string;
  icon: ReactNode;
  step: string;
  title: string;
}>;

function Field({ children, error, label, name, optional = false }: FieldProps) {
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

function RegistrationSection({
  children,
  description,
  icon,
  step,
  title,
}: SectionProps) {
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

export function RegistrationPage({
  initialRole,
  onBack,
}: RegistrationPageProps) {
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [isReadyForApi, setIsReadyForApi] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleRoleChange = (nextRole: RegistrationRole) => {
    setRole(nextRole);
    setErrors({});
    setIsReadyForApi(false);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateRegistration(
      new FormData(event.currentTarget),
      role,
    );

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
        }
      });
      return;
    }

    setErrors({});
    setIsReadyForApi(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isReadyForApi) {
    return (
      <main className="registration-page registration-success-page">
        <header className="registration-header">
          <button onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" />
            {th.registration.backToLogin}
          </button>
        </header>
        <section className="registration-success" aria-live="polite">
          <span aria-hidden="true">
            <CheckCircle2 />
          </span>
          <p>{th.registration.eyebrow}</p>
          <h1>{th.registration.success.title}</h1>
          <strong>{th.registration.success[role]}</strong>
          <small>{th.registration.success.note}</small>
          <div>
            <button onClick={() => setIsReadyForApi(false)} type="button">
              {th.registration.success.edit}
            </button>
            <button className="is-primary" onClick={onBack} type="button">
              {th.registration.success.login}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-page">
      <header className="registration-header">
        <a className="registration-brand" href="#registration-top">
          <span aria-hidden="true">
            <HandHeart />
          </span>
          <span>
            <strong>{th.brand}</strong>
            <small>{th.registration.brandEnglish}</small>
          </span>
        </a>
        <button onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" />
          {th.registration.backToLogin}
        </button>
      </header>

      <div className="registration-content" id="registration-top">
        <section className="registration-intro">
          <div>
            <p>{th.registration.eyebrow}</p>
            <h1>{th.registration.title[role]}</h1>
            <span>{th.registration.description[role]}</span>
          </div>
          <div
            className="registration-role-switch"
            aria-label={th.registration.roleLabel}
          >
            {(['consumer', 'merchant'] as const).map((registrationRole) => {
              const Icon = registrationRole === 'consumer' ? UserRound : Store;

              return (
                <button
                  aria-pressed={role === registrationRole}
                  className={role === registrationRole ? 'is-active' : ''}
                  key={registrationRole}
                  onClick={() => handleRoleChange(registrationRole)}
                  type="button"
                >
                  <Icon aria-hidden="true" />
                  {th.registration.roles[registrationRole]}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="existing-identity-note">
          <ShieldCheck aria-hidden="true" />
          <p>{th.registration.existingIdentity}</p>
        </aside>

        <form
          className="registration-form"
          key={role}
          noValidate
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <RegistrationSection
            description={th.registration.sections.identity.description}
            icon={<IdCard />}
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
                <select
                  {...getAccessibilityProps('title', errors)}
                  id="title"
                  name="title"
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
                  name="birthDate"
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
            icon={<MapPinHouse />}
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
              <Field
                error={errors.subdistrict}
                label={th.registration.fields.subdistrict}
                name="subdistrict"
              >
                <input
                  {...getAccessibilityProps('subdistrict', errors)}
                  id="subdistrict"
                  name="subdistrict"
                />
              </Field>
              <Field
                error={errors.district}
                label={th.registration.fields.district}
                name="district"
              >
                <input
                  {...getAccessibilityProps('district', errors)}
                  id="district"
                  name="district"
                />
              </Field>
              <Field
                error={errors.province}
                label={th.registration.fields.province}
                name="province"
              >
                <input
                  {...getAccessibilityProps('province', errors)}
                  id="province"
                  name="province"
                />
              </Field>
              <Field
                error={errors.postalCode}
                label={th.registration.fields.postalCode}
                name="postalCode"
              >
                <input
                  {...getAccessibilityProps('postalCode', errors)}
                  autoComplete="postal-code"
                  id="postalCode"
                  inputMode="numeric"
                  maxLength={5}
                  name="postalCode"
                  onInput={(event) => {
                    event.currentTarget.value = digitsOnly(
                      event.currentTarget.value,
                      5,
                    );
                  }}
                />
              </Field>
            </div>
          </RegistrationSection>

          <RegistrationSection
            description={th.registration.sections.account.description}
            icon={<KeyRound />}
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
            <div className="password-rule-card">
              <BadgeCheck aria-hidden="true" />
              <p>
                <strong>{th.registration.passwordRules.title}</strong>
                <span>{th.registration.passwordRules.detail}</span>
              </p>
            </div>
          </RegistrationSection>

          {role === 'merchant' ? (
            <RegistrationSection
              description={th.registration.sections.merchant.description}
              icon={<Building2 />}
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
                  error={errors.merchantType}
                  label={th.registration.fields.merchantType}
                  name="merchantType"
                >
                  <select
                    {...getAccessibilityProps('merchantType', errors)}
                    id="merchantType"
                    name="merchantType"
                  >
                    <option value="">
                      {th.registration.placeholders.selectMerchantType}
                    </option>
                    {th.registration.merchantTypes.map((merchantType) => (
                      <option key={merchantType} value={merchantType}>
                        {merchantType}
                      </option>
                    ))}
                  </select>
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
                <Field
                  error={errors.merchantSubdistrict}
                  label={th.registration.fields.subdistrict}
                  name="merchantSubdistrict"
                >
                  <input
                    {...getAccessibilityProps('merchantSubdistrict', errors)}
                    id="merchantSubdistrict"
                    name="merchantSubdistrict"
                  />
                </Field>
                <Field
                  error={errors.merchantDistrict}
                  label={th.registration.fields.district}
                  name="merchantDistrict"
                >
                  <input
                    {...getAccessibilityProps('merchantDistrict', errors)}
                    id="merchantDistrict"
                    name="merchantDistrict"
                  />
                </Field>
                <Field
                  error={errors.merchantProvince}
                  label={th.registration.fields.province}
                  name="merchantProvince"
                >
                  <input
                    {...getAccessibilityProps('merchantProvince', errors)}
                    id="merchantProvince"
                    name="merchantProvince"
                  />
                </Field>
                <Field
                  error={errors.merchantPostalCode}
                  label={th.registration.fields.postalCode}
                  name="merchantPostalCode"
                >
                  <input
                    {...getAccessibilityProps('merchantPostalCode', errors)}
                    id="merchantPostalCode"
                    inputMode="numeric"
                    maxLength={5}
                    name="merchantPostalCode"
                    onInput={(event) => {
                      event.currentTarget.value = digitsOnly(
                        event.currentTarget.value,
                        5,
                      );
                    }}
                  />
                </Field>
              </div>
            </RegistrationSection>
          ) : null}

          <section className="registration-consent">
            <label>
              <input name="acceptTerms" type="checkbox" />
              <span>{th.registration.consent.terms}</span>
            </label>
            {errors.acceptTerms ? (
              <p className="registration-error">
                {th.registration.validation.acceptTerms}
              </p>
            ) : null}
            <label>
              <input name="acceptPrivacy" type="checkbox" />
              <span>{th.registration.consent.privacy}</span>
            </label>
            {errors.acceptPrivacy ? (
              <p className="registration-error">
                {th.registration.validation.acceptPrivacy}
              </p>
            ) : null}
            {role === 'merchant' ? (
              <>
                <label>
                  <input name="acceptMerchantTerms" type="checkbox" />
                  <span>{th.registration.consent.merchantTerms}</span>
                </label>
                {errors.acceptMerchantTerms ? (
                  <p className="registration-error">
                    {th.registration.validation.acceptMerchantTerms}
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <footer className="registration-submit-bar">
            <div>
              <small>{th.registration.requiredHint}</small>
              {Object.keys(errors).length > 0 ? (
                <p aria-live="assertive">
                  {th.registration.validation.summary}
                </p>
              ) : null}
            </div>
            <button type="submit">
              <CheckCircle2 aria-hidden="true" />
              {th.registration.submit[role]}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
