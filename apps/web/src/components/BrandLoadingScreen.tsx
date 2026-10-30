import { th } from '../i18n/th';

export interface BrandLoadingScreenProps {
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

/**
 * Reusable animated Thai Please brand logo with radiant aura rings,
 * breathing motion, and dynamic brand color dot pulses.
 */
export function BrandLogoAnimation({
  size = 'md',
}: Readonly<{ size?: 'sm' | 'md' | 'lg' }>) {
  const sizeConfig = {
    sm: {
      card: 'p-4 rounded-2xl',
      logo: 'h-10 sm:h-12 max-w-[140px]',
      ringOuter: 'size-28',
      ringInner: 'size-20',
    },
    md: {
      card: 'p-6 rounded-3xl',
      logo: 'h-14 sm:h-16 max-w-[190px]',
      ringOuter: 'size-36',
      ringInner: 'size-28',
    },
    lg: {
      card: 'p-8 rounded-3xl',
      logo: 'h-18 sm:h-22 max-w-[240px]',
      ringOuter: 'size-48',
      ringInner: 'size-36',
    },
  }[size];

  return (
    <div className="relative flex items-center justify-center py-4">
      {/* Outer ambient glow ripple */}
      <div
        className={`absolute ${sizeConfig.ringOuter} rounded-full bg-blue-400/20 blur-xl animate-pulse`}
        aria-hidden="true"
        style={{ animationDuration: '3s' }}
      />

      {/* Concentric radiating ripple rings */}
      <div
        className={`absolute ${sizeConfig.ringOuter} rounded-full border border-blue-200/60 bg-blue-50/40 animate-ping`}
        aria-hidden="true"
        style={{ animationDuration: '2.4s' }}
      />
      <div
        className={`absolute ${sizeConfig.ringInner} rounded-full border-2 border-emerald-300/40 bg-emerald-50/30 animate-pulse`}
        aria-hidden="true"
        style={{ animationDuration: '1.8s' }}
      />

      {/* Floating Card containing the Thai Please Logo */}
      <div
        className={`relative ${sizeConfig.card} bg-white/95 backdrop-blur-md shadow-lg shadow-blue-900/10 border border-slate-100 flex flex-col items-center justify-center transition-transform motion-safe:animate-bounce-subtle`}
      >
        <img
          src="/images/brand-logo.png"
          alt={th.brand}
          className={`${sizeConfig.logo} w-auto object-contain object-center drop-shadow-xs`}
        />

        {/* Subtle decorative dot indicator matching Thai Please tricolor */}
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          <span
            className="size-1.5 rounded-full bg-[#0056b3] animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="size-1.5 rounded-full bg-[#00a651] animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="size-1.5 rounded-full bg-[#e31e24] animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page branded loading screen used when checking user session, permissions,
 * and during initial app/route verification.
 */
export function BrandLoadingScreen({
  label = th.app.checkingSession,
  sublabel = 'ระบบไทยช่วยไทยพรีส • กำลังตรวจสอบสถานะการใช้งาน',
  size = 'md',
  fullScreen = true,
}: Readonly<BrandLoadingScreenProps>) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center justify-center text-center max-w-sm mx-auto px-4"
    >
      <BrandLogoAnimation size={size} />

      {/* Status Label with shimmer effect */}
      <div className="mt-4 space-y-1.5">
        <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
          {label}
        </h2>
        {sublabel && (
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {sublabel}
          </p>
        )}
      </div>

      {/* Sleek indeterminate progress track */}
      <div
        className="mt-5 w-48 h-1.5 bg-slate-200/80 rounded-full overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-full w-24 bg-gradient-to-r from-[#0056b3] via-[#00a651] to-[#0056b3] rounded-full animate-progress-indeterminate" />
      </div>
    </div>
  );

  if (!fullScreen) {
    return content;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/80 p-6 select-none">
      {content}
    </div>
  );
}
