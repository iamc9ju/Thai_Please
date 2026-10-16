import {
  Bell,
  CircleUserRound,
  LogOut,
  Menu,
  QrCode,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

export interface ConsumerTopBarProps {
  activeView: ConsumerView;
  displayName: string;
  onOpenMobile: () => void;
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
  onOpenMobile,
  onNavigate,
  onNotification,
  onOpenProfile,
  onLogout,
}: ConsumerTopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Mobile Menu Toggle & Page Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Menu className="size-5" />
        </button>

        {/* Brand logo for mobile screen */}
        <div className="lg:hidden flex items-center gap-1.5">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-9 sm:h-10 w-auto object-contain"
          />
        </div>

        {/* Active View Title */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">
            {th.consumerDashboard.brand}
          </span>
          <span className="text-slate-300">/</span>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {viewTitles[activeView]}
          </h1>
        </div>
      </div>

      {/* Right: Quick Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Fast QR Payment CTA */}
        {activeView !== 'payment' && (
          <button
            type="button"
            onClick={() => onNavigate('payment')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0056b3] text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <QrCode className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">
              {th.consumerDashboard.payment.action}
            </span>
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

        {/* Profile Summary Button */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <CircleUserRound className="size-5 text-[#0056b3]" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-800 max-w-[120px] truncate">
            {displayName}
          </span>
        </button>

        {/* Quick Logout Button */}
        <button
          type="button"
          onClick={onLogout}
          aria-label={th.consumerDashboard.logout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          title={th.consumerDashboard.logout}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
