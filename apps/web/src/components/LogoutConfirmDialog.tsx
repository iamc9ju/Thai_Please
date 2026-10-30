import { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { th } from '../i18n/th';

export interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LogoutConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: Readonly<LogoutConfirmDialogProps>) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
    >
      {/* Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onCancel}
          aria-label={th.logoutConfirm.close}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        {/* Warning / LogOut Icon Podium */}
        <div className="relative mb-4 flex items-center justify-center" aria-hidden="true">
          <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 ring-8 ring-amber-50/70 flex items-center justify-center shadow-xs">
            <LogOut className="size-8" />
          </div>
        </div>

        {/* Heading & Description */}
        <h3
          id="logout-confirm-title"
          className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
        >
          {th.logoutConfirm.title}
        </h3>

        <p
          id="logout-confirm-desc"
          className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs sm:max-w-sm"
        >
          {th.logoutConfirm.description}
        </p>

        {/* Action Buttons: Cancel vs Confirm */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-all active:scale-98 cursor-pointer"
          >
            {th.logoutConfirm.cancel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all active:scale-98 cursor-pointer"
          >
            {th.logoutConfirm.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
