import { Bell, CircleUserRound, LogOut, QrCode } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

export interface ConsumerTopBarProps {
  activeView: ConsumerView;
  displayName: string;
  onOpenMobile?: () => void;
  onNavigate: (view: ConsumerView) => void;
  onNotification: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const viewTitles: Record<ConsumerView, string> = {
  overview: th.consumerPortal.navigation.overview,
  wallet: th.consumerPortal.navigation.wallet,
  payment: th.consumerPortal.navigation.payment,
  orders: th.consumerPortal.navigation.orders,
  quests: th.consumerPortal.navigation.quests,
  rewards: th.consumerPortal.navigation.rewards,
  profile: th.consumerPortal.navigation.profile,
};

export function ConsumerTopBar({
  activeView,
  displayName,
  onOpenMobile: _onOpenMobile,
  onNavigate,
  onNotification,
  onOpenProfile,
  onLogout,
}: ConsumerTopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between select-none">
      {/* Left: Mobile/Tablet Brand Logo & Desktop Page Title */}
      <div className="flex items-center gap-3">
        {/* Brand logo for mobile and tablet */}
        <div className="lg:hidden flex items-center">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </div>

        {/* Desktop Breadcrumbs and Title */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">
            {th.consumerDashboard.brand}
          </span>
          <span className="text-slate-300">/</span>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {viewTitles[activeView]}
          </h1>
        </div>
      </div>

      {/* Right: Quick Actions, Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Fast QR Payment CTA (Desktop only - mobile has bottom center bar) */}
        {activeView !== 'payment' && (
          <button
            type="button"
            onClick={() => onNavigate('payment')}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0056b3] text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <QrCode className="size-4" aria-hidden="true" />
            <span>{th.consumerDashboard.payment.action}</span>
          </button>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          onClick={onNotification}
          aria-label={th.consumerDashboard.notification}
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full ring-2 ring-white"
          />
        </button>

        {/* Profile Avatar Button (Mobile/Tablet circular avatar matching mockup) */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={th.consumerDashboard.identityLabel}
          className="lg:hidden size-9 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-[#0056b3]/30 transition-all cursor-pointer"
        >
          {displayName.slice(0, 1)}
        </button>

        {/* Profile Summary Button (Desktop) */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="hidden lg:flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <CircleUserRound
            className="size-5 text-[#0056b3]"
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-slate-800 max-w-[120px] truncate">
            {displayName}
          </span>
        </button>

        {/* Quick Logout Button (Desktop) */}
        <button
          type="button"
          onClick={onLogout}
          aria-label={th.consumerDashboard.logout}
          className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title={th.consumerDashboard.logout}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
