import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LogIn,
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
  const { id, type = 'info', title, description, badge, duration = 4000 } = toast;
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (duration <= 0 || isPaused) return;

    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, isPaused, onDismiss]);

  const configByType = {
    'login-success': {
      icon: LogIn,
      iconWrap:
        'bg-emerald-50 text-emerald-600 border border-emerald-200/80 ring-4 ring-emerald-50/50',
      badgeDefault: th.authToast.roles.consumer,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200/60',
      progressGradient: 'from-emerald-500 to-teal-500',
    },
    'logout-success': {
      icon: LogOut,
      iconWrap:
        'bg-blue-50 text-[#0056b3] border border-blue-200/80 ring-4 ring-blue-50/50',
      badgeDefault: 'ระบบ',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200/60',
      progressGradient: 'from-[#0056b3] to-sky-400',
    },
    success: {
      icon: CheckCircle2,
      iconWrap:
        'bg-emerald-50 text-emerald-600 border border-emerald-200/80 ring-4 ring-emerald-50/50',
      badgeDefault: 'สำเร็จ',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200/60',
      progressGradient: 'from-emerald-500 to-teal-500',
    },
    info: {
      icon: Info,
      iconWrap:
        'bg-sky-50 text-sky-600 border border-sky-200/80 ring-4 ring-sky-50/50',
      badgeDefault: 'แจ้งเตือน',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200/60',
      progressGradient: 'from-sky-500 to-indigo-500',
    },
    warning: {
      icon: AlertCircle,
      iconWrap:
        'bg-amber-50 text-amber-600 border border-amber-200/80 ring-4 ring-amber-50/50',
      badgeDefault: 'คำเตือน',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200/60',
      progressGradient: 'from-amber-500 to-orange-500',
    },
    error: {
      icon: AlertCircle,
      iconWrap:
        'bg-rose-50 text-rose-600 border border-rose-200/80 ring-4 ring-rose-50/50',
      badgeDefault: 'ข้อผิดพลาด',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200/60',
      progressGradient: 'from-rose-500 to-red-500',
    },
  }[type];

  const Icon = configByType.icon;
  const currentBadge = badge ?? configByType.badgeDefault;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all duration-300 select-none animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start gap-3.5">
        {/* Left Icon Badge (blocks.so style) */}
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${configByType.iconWrap}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>

        {/* Content Section */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {title}
            </h4>
            {currentBadge && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${configByType.badgeClass}`}
              >
                {currentBadge}
              </span>
            )}
            <span className="ml-auto text-[10px] text-slate-400 font-medium shrink-0">
              {th.authToast.timeJustNow}
            </span>
          </div>

          {description && (
            <p className="mt-1 text-xs text-slate-600 leading-relaxed break-words">
              {description}
            </p>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label={th.authToast.dismiss}
          className="ml-1 -mr-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Auto-dismissing Progress Bar */}
      {duration > 0 && (
        <div
          className="absolute bottom-0 left-0 h-1 w-full bg-slate-100"
          aria-hidden="true"
        >
          <div
            className={`h-full bg-gradient-to-r ${configByType.progressGradient}`}
            style={{
              animation: `toast-shrink ${duration}ms linear forwards`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}
