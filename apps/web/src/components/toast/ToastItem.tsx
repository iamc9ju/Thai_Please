import { useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LogOut,
  X,
} from 'lucide-react';
import { th } from '../../i18n/th';

export type ToastType =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'login-success'
  | 'logout-success';

export interface ToastMessage {
  id: string;
  type?: ToastType;
  title: string;
  description?: string;
  badge?: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: Readonly<ToastItemProps>) {
  const { id, type = 'info', title, description, badge, duration = 3500 } = toast;
  const isAuthModal = type === 'login-success' || type === 'logout-success';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id, onDismiss]);

  // Auto-dismiss countdown (runs continuously without pausing on hover)
  useEffect(() => {
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const configByType = {
    'login-success': {
      icon: CheckCircle2,
      ringAura: 'bg-emerald-100/60',
      iconWrap:
        'bg-emerald-50 text-emerald-600 border border-emerald-200/80 ring-8 ring-emerald-50/70',
      badgeDefault: th.authToast.roles.consumer,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      buttonClass: 'bg-[#0056b3] hover:bg-[#004494] shadow-blue-700/20',
      progressGradient: 'from-emerald-500 via-[#0056b3] to-teal-500',
      actionLabel: th.authToast.goToDashboard,
    },
    'logout-success': {
      icon: LogOut,
      ringAura: 'bg-blue-100/60',
      iconWrap:
        'bg-blue-50 text-[#0056b3] border border-blue-200/80 ring-8 ring-blue-50/70',
      badgeDefault: 'ความปลอดภัยระบบ',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200/80',
      buttonClass: 'bg-[#0056b3] hover:bg-[#004494] shadow-blue-700/20',
      progressGradient: 'from-[#0056b3] via-sky-400 to-[#0056b3]',
      actionLabel: th.authToast.confirm,
    },
    success: {
      icon: CheckCircle2,
      ringAura: 'bg-emerald-100/60',
      iconWrap:
        'bg-emerald-50 text-emerald-600 border border-emerald-200/80 ring-8 ring-emerald-50/70',
      badgeDefault: 'สำเร็จ',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      buttonClass: 'bg-[#0056b3] hover:bg-[#004494] shadow-blue-700/20',
      progressGradient: 'from-emerald-500 to-teal-500',
      actionLabel: th.authToast.confirm,
    },
    info: {
      icon: Info,
      ringAura: 'bg-sky-100/60',
      iconWrap:
        'bg-sky-50 text-sky-600 border border-sky-200/80 ring-8 ring-sky-50/70',
      badgeDefault: 'แจ้งเตือน',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200/80',
      buttonClass: 'bg-[#0056b3] hover:bg-[#004494] shadow-blue-700/20',
      progressGradient: 'from-sky-500 to-indigo-500',
      actionLabel: th.authToast.confirm,
    },
    warning: {
      icon: AlertCircle,
      ringAura: 'bg-amber-100/60',
      iconWrap:
        'bg-amber-50 text-amber-600 border border-amber-200/80 ring-8 ring-amber-50/70',
      badgeDefault: 'คำเตือน',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200/80',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-700/20',
      progressGradient: 'from-amber-500 to-orange-500',
      actionLabel: th.authToast.confirm,
    },
    error: {
      icon: AlertCircle,
      ringAura: 'bg-rose-100/60',
      iconWrap:
        'bg-rose-50 text-rose-600 border border-rose-200/80 ring-8 ring-rose-50/70',
      badgeDefault: 'ข้อผิดพลาด',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200/80',
      buttonClass: 'bg-rose-600 hover:bg-rose-700 shadow-rose-700/20',
      progressGradient: 'from-rose-500 to-red-500',
      actionLabel: th.authToast.confirm,
    },
  }[type];

  const Icon = configByType.icon;
  const currentBadge = badge ?? configByType.badgeDefault;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
        onClick={() => onDismiss(id)}
        aria-hidden="true"
      />

      {/* Modal Dialog Card (Centered, Thai Please Theme) */}
      <div
        className="relative z-10 w-full max-w-sm sm:max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center select-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label={th.authToast.dismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        {/* Brand Logo Header */}
        <div className="mb-4 flex items-center justify-center">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-10 sm:h-12 w-auto object-contain mx-auto"
          />
        </div>

        {/* Center Icon Podium with Pulsing Ripple Ring - Hidden for auth modals (login/logout) as requested */}
        {!isAuthModal && (
          <div className="relative mb-4 flex items-center justify-center" aria-hidden="true">
            <div
              className={`absolute size-20 rounded-full ${configByType.ringAura} animate-ping`}
              style={{ animationDuration: '2.5s' }}
            />
            <div
              className={`relative size-16 rounded-2xl flex items-center justify-center shadow-xs transition-transform motion-safe:animate-bounce-subtle ${configByType.iconWrap}`}
            >
              <Icon className="size-8" />
            </div>
          </div>
        )}

        {/* Role / Status Badge - Hidden for auth modals (login/logout) as requested */}
        {!isAuthModal && currentBadge && (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold mb-2.5 ${configByType.badgeClass}`}
          >
            {currentBadge}
          </span>
        )}

        {/* Modal Heading & Description */}
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {title}
        </h3>

        {description && (
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs sm:max-w-sm">
            {description}
          </p>
        )}

        {/* Primary Action Button (Thai Please Theme) */}
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className={`mt-6 w-full py-3 px-5 rounded-xl text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer ${configByType.buttonClass}`}
        >
          {configByType.actionLabel}
        </button>

        {/* Auto-dismissing Progress Indicator (runs continuously) */}
        {duration > 0 && (
          <div
            className="mt-4 w-32 h-1 bg-slate-100 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className={`h-full bg-gradient-to-r ${configByType.progressGradient}`}
              style={{
                animation: `toast-shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
