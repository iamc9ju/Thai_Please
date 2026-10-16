import {
  CircleUserRound,
  ClipboardList,
  Home,
  LogOut,
  QrCode,
  Sparkles,
  TicketPercent,
  WalletCards,
  X,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

export interface ConsumerSidebarProps {
  activeView: ConsumerView;
  displayName: string;
  maskedCitizenId: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (view: ConsumerView) => void;
  onLogout: () => void;
}

const navItems = [
  {
    view: 'overview',
    label: th.consumerPortal.navigation.overview,
    icon: Home,
  },
  {
    view: 'wallet',
    label: th.consumerPortal.navigation.wallet,
    icon: WalletCards,
  },
  {
    view: 'payment',
    label: th.consumerPortal.navigation.payment,
    icon: QrCode,
  },
  {
    view: 'orders',
    label: th.consumerPortal.navigation.orders,
    icon: ClipboardList,
  },
  {
    view: 'quests',
    label: th.consumerPortal.navigation.quests,
    icon: Sparkles,
  },
  {
    view: 'rewards',
    label: th.consumerPortal.navigation.rewards,
    icon: TicketPercent,
  },
  {
    view: 'profile',
    label: th.consumerPortal.navigation.profile,
    icon: CircleUserRound,
  },
] as const;

export function ConsumerSidebar({
  activeView,
  displayName,
  maskedCitizenId,
  isMobileOpen,
  onCloseMobile,
  onNavigate,
  onLogout,
}: ConsumerSidebarProps) {
  const handleItemClick = (view: ConsumerView) => {
    onNavigate(view);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Top Branding & Main Navigation */}
      <div>
        {/* Brand Logo */}
        <div className="px-6 py-6 flex items-center justify-center relative">
          <img
            src="/images/brand-logo.png"
            alt={th.brand}
            className="h-14 xl:h-16 w-auto max-w-[210px] object-contain object-center mx-auto"
          />

          {/* Close Button on Mobile Drawer */}
          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav
          className="p-4 space-y-1.5"
          aria-label={th.consumerDashboard.navigation.label}
        >
          {navItems.map(({ view, label, icon: Icon }) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => handleItemClick(view)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0056b3] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-98'
                }`}
              >
                <Icon
                  className={`size-4.5 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile Card & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-blue-100 text-[#0056b3] flex items-center justify-center font-bold text-base shrink-0">
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-slate-900 truncate block">
              {displayName}
            </span>
            <small className="text-xs text-slate-500 font-mono block">
              {maskedCitizenId}
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100/60 transition-all cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>{th.consumerDashboard.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 bg-white border-r border-slate-200/80 flex-col shrink-0 min-h-screen sticky top-0 h-screen select-none">
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-50 select-none animate-in slide-in-from-left duration-200"
            aria-label={th.consumerDashboard.navigation.label}
          >
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
