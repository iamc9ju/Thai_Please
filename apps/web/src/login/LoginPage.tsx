import {
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  HandHeart,
  Headphones,
  LockKeyhole,
  ShieldCheck,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { ConsumerDashboard } from '../consumer/ConsumerDashboard';
import { th } from '../i18n/th';
import { LOGIN_ROLES, type LoginRole } from './login.types';
import { authenticateMockUser, mockAuthIsAvailable } from './mockUsers';
import { RolePreview } from './RolePreview';

const roleIcons: Record<LoginRole, LucideIcon> = {
  consumer: UserRound,
  merchant: Store,
  administrator: ShieldCheck,
};

export function LoginPage() {
  const [role, setRole] = useState<LoginRole>('consumer');
  const [citizenId, setCitizenId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [authenticatedRole, setAuthenticatedRole] = useState<LoginRole | null>(
    null,
  );

  const citizenIdIsValid = /^\d{13}$/.test(citizenId);
  const canSubmit = citizenIdIsValid && password.length > 0;
  const citizenIdError = useMemo(() => {
    if (citizenId.length === 0 || citizenIdIsValid) {
      return '';
    }

    return th.login.validation.citizenId;
  }, [citizenId, citizenIdIsValid]);

  const handleCitizenIdChange = (value: string) => {
    setCitizenId(value.replace(/\D/g, '').slice(0, 13));
    setFeedback('');
  };

  const handleRoleChange = (nextRole: LoginRole) => {
    setRole(nextRole);
    setFeedback('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    if (!mockAuthIsAvailable) {
      setFeedback(th.login.mockUnavailable);
      return;
    }

    if (!authenticateMockUser(role, citizenId, password)) {
      setFeedback(th.login.invalidCredentials);
      return;
    }

    setPassword('');
    setFeedback('');
    setAuthenticatedRole(role);
  };

  const handleUnavailableAction = () => {
    setFeedback(th.login.unavailableFeedback);
  };

  const handleLogout = () => {
    setAuthenticatedRole(null);
    setCitizenId('');
    setPassword('');
    setRemember(false);
    setFeedback('');
  };

  if (authenticatedRole === 'consumer') {
    return <ConsumerDashboard citizenId={citizenId} onLogout={handleLogout} />;
  }

  if (authenticatedRole !== null) {
    return <RolePreview onBack={handleLogout} role={authenticatedRole} />;
  }

  return (
    <main className="login-page">
      <div aria-hidden="true" className="community-backdrop">
        <div className="sun-glow" />
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="mountain mountain-one" />
        <div className="mountain mountain-two" />
        <div className="community-ground" />
        <div className="market market-one">
          <span className="market-roof" />
          <span className="market-awning" />
          <span className="market-window" />
          <span className="market-door" />
        </div>
        <div className="market market-two">
          <span className="market-roof" />
          <span className="market-awning" />
          <span className="market-window" />
          <span className="market-door" />
        </div>
        <div className="scene-overlay" />
      </div>

      <header className="brand-lockup">
        <span aria-hidden="true" className="brand-symbol">
          <HandHeart />
        </span>
        <span>
          <strong>{th.brand}</strong>
          <small>{th.login.brandEnglish}</small>
        </span>
      </header>

      <a className="back-link" href="/">
        <ArrowLeft aria-hidden="true" />
        {th.login.backToWebsite}
      </a>

      <section className="project-summary" aria-labelledby="project-title">
        <span className="project-badge">{th.login.projectBadge}</span>
        <h1 id="project-title">
          {th.login.heroTitle.primary}
          <br />
          {th.login.heroTitle.secondary}
        </h1>
        <p>{th.login.heroDescription}</p>
        <div className="benefit-list" aria-label={th.login.benefits.label}>
          <span>{th.login.benefits.subsidy}</span>
          <span>{th.login.benefits.community}</span>
        </div>
      </section>

      <aside className="login-card" aria-labelledby="login-title">
        <div className="thai-flag-stripe" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="login-card-content">
          <div className="login-heading">
            <p>{th.login.welcome}</p>
            <h2 id="login-title">{th.login.title}</h2>
            <span>{th.login.subtitle}</span>
          </div>

          <div className="role-selector" aria-label={th.login.role.label}>
            {LOGIN_ROLES.map((loginRole) => {
              const RoleIcon = roleIcons[loginRole];

              return (
                <button
                  aria-pressed={role === loginRole}
                  className={role === loginRole ? 'is-active' : ''}
                  key={loginRole}
                  onClick={() => handleRoleChange(loginRole)}
                  type="button"
                >
                  <RoleIcon aria-hidden="true" className="role-icon" />
                  {th.login.role.options[loginRole]}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="citizen-id">
              {th.login.fields.citizenId.label}
            </label>
            <div className="field-shell">
              <CreditCard aria-hidden="true" className="field-icon" />
              <input
                aria-describedby={
                  citizenIdError ? 'citizen-id-error' : undefined
                }
                aria-invalid={citizenIdError.length > 0}
                autoComplete="username"
                id="citizen-id"
                inputMode="numeric"
                maxLength={13}
                onChange={(event) => handleCitizenIdChange(event.target.value)}
                placeholder={th.login.fields.citizenId.placeholder}
                value={citizenId}
              />
              <span className="field-counter">{citizenId.length}/13</span>
            </div>
            <p className="field-error" id="citizen-id-error">
              {citizenIdError}
            </p>

            <label htmlFor="password">{th.login.fields.password.label}</label>
            <div className="field-shell">
              <LockKeyhole aria-hidden="true" className="field-icon" />
              <input
                autoComplete="current-password"
                id="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFeedback('');
                }}
                placeholder={th.login.fields.password.placeholder}
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={
                  showPassword
                    ? th.login.fields.password.hide
                    : th.login.fields.password.show
                }
                className="password-visibility"
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                {th.login.remember}
              </label>
              <button onClick={handleUnavailableAction} type="button">
                {th.login.forgotPassword}
              </button>
            </div>

            <p aria-live="polite" className="form-feedback">
              {feedback}
            </p>

            <button
              className="submit-button"
              disabled={!canSubmit}
              type="submit"
            >
              {th.login.submit}
            </button>
          </form>

          {role !== 'administrator' ? (
            <p className="register-prompt">
              {th.login.registration.prompt}{' '}
              <button onClick={handleUnavailableAction} type="button">
                {th.login.registration.actions[role]}
              </button>
            </p>
          ) : null}

          <div className="support-note">
            <Headphones aria-hidden="true" />
            <p>
              {th.login.support.description}
              <br />
              <strong>{th.login.support.contact}</strong>
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
