import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { th } from '../../../i18n/th';
import { RegistrationPage } from '../../registration/pages/RegistrationPage';
import type { RegistrationRole } from '../../registration/registration.validation';
import { useAuth } from '../use-auth';
import type { LoginRole } from '../auth.types';

export interface LoginPageProps {
  onBack?: () => void;
}

export function LoginPage({ onBack }: LoginPageProps = {}) {
  const { login } = useAuth();
  const [role, setRole] = useState<LoginRole>('consumer');
  const [citizenId, setCitizenId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationRole, setRegistrationRole] =
    useState<RegistrationRole | null>(null);

  const citizenIdIsValid = /^\d{13}$/.test(citizenId);
  const canSubmit = citizenIdIsValid && password.length > 0 && !isSubmitting;
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setFeedback('');

    try {
      await login(role, {
        citizenId,
        password,
      });

      setPassword('');
      setFeedback('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback(err.message);
      } else {
        setFeedback('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registrationRole !== null) {
    return (
      <RegistrationPage
        initialRole={registrationRole}
        onBack={() => setRegistrationRole(null)}
      />
    );
  }

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-center items-center bg-slate-50/60 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      {/* Top-left Back to Website Button */}
      <div className="absolute top-5 left-5 sm:top-6 sm:left-6 z-20">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all cursor-pointer"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{th.login.backToWebsite}</span>
        </button>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8 flex flex-col">
        {/* Brand Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-12 w-auto object-contain"
          />
        </div>
          {/* Header Title Block */}
          <div className="text-center mb-6">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mb-1">
              {th.login.welcome}
            </p>
            <h2
              id="login-title"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1"
            >
              {th.login.title}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              {th.login.subtitle}
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div
            role="group"
            aria-label={th.login.role.label}
            className="grid grid-cols-3 gap-1 p-1 rounded-2xl border border-slate-200 bg-white mb-6"
          >
            <button
              type="button"
              onClick={() => handleRoleChange('consumer')}
              aria-pressed={role === 'consumer'}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                role === 'consumer'
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <User className="size-4 shrink-0" aria-hidden="true" />
              <span>{th.login.role.options.consumer}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleChange('merchant')}
              aria-pressed={role === 'merchant'}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                role === 'merchant'
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Store className="size-4 shrink-0" aria-hidden="true" />
              <span>{th.login.role.options.merchant}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleChange('administrator')}
              aria-pressed={role === 'administrator'}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                role === 'administrator'
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              <span>{th.login.role.options.administrator}</span>
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Citizen ID Field */}
            <label
              htmlFor="citizen-id"
              className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
            >
              {th.login.fields.citizenId.label}
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-all focus-within:border-[#0056b3] focus-within:ring-2 focus-within:ring-blue-500/20 mb-1">
              <CreditCard className="size-5 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                id="citizen-id"
                autoComplete="username"
                inputMode="numeric"
                maxLength={13}
                value={citizenId}
                onChange={(event) => handleCitizenIdChange(event.target.value)}
                placeholder={th.login.fields.citizenId.placeholder}
                aria-describedby={citizenIdError ? 'citizen-id-error' : undefined}
                aria-invalid={citizenIdError.length > 0}
                className="w-full pl-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
            </div>
            {citizenIdError ? (
              <p className="text-xs text-red-500 mb-3" id="citizen-id-error">
                {citizenIdError}
              </p>
            ) : (
              <div className="h-3" />
            )}

            {/* Password Field */}
            <label
              htmlFor="password"
              className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
            >
              {th.login.fields.password.label}
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-all focus-within:border-[#0056b3] focus-within:ring-2 focus-within:ring-blue-500/20 mb-3">
              <Lock className="size-5 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFeedback('');
                }}
                placeholder={th.login.fields.password.placeholder}
                className="w-full pl-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? th.login.fields.password.hide
                    : th.login.fields.password.show
                }
                className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="size-4.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-4.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Error or Feedback message */}
            {feedback && (
              <p aria-live="polite" className="text-xs text-red-600 mb-3 font-medium">
                {feedback}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0056b3] py-3.5 text-sm sm:text-base font-bold text-white shadow-md hover:bg-[#004494] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : th.login.submit}</span>
              <ArrowRight className="size-4.5" aria-hidden="true" />
            </button>
          </form>

          {/* Registration Navigation Link */}
          {role !== 'administrator' && (
            <div className="mt-6 text-center text-xs sm:text-sm text-slate-500">
              <span>
                {role === 'consumer'
                  ? th.login.registration.promptConsumer
                  : th.login.registration.promptMerchant}
              </span>{' '}
              <button
                type="button"
                onClick={() =>
                  setRegistrationRole(
                    role === 'consumer' ? 'consumer' : 'merchant',
                  )
                }
                className="font-bold text-[#0056b3] hover:underline cursor-pointer ml-1"
              >
                {th.login.registration.actions[role]}
              </button>
            </div>
          )}

          {/* Security Verification Badge */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
            <ShieldCheck className="size-4 text-slate-500" aria-hidden="true" />
            <span>{th.login.securityNote}</span>
          </div>
        </div>
    </main>
  );
}
