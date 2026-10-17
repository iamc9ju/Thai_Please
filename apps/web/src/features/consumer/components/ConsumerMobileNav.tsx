import { ClipboardList, Home, QrCode, Ticket, WalletCards } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

export interface ConsumerMobileNavProps {
  activeView: ConsumerView;
  onNavigate: (view: ConsumerView) => void;
}

export function ConsumerMobileNav({
  activeView,
  onNavigate,
}: ConsumerMobileNavProps) {
  const items = [
    {
      view: 'overview' as const,
      label: th.consumerDashboard.mobileNav.home,
      icon: Home,
    },
    {
      view: 'wallet' as const,
      label: th.consumerDashboard.mobileNav.wallet,
      icon: WalletCards,
    },
    {
      view: 'payment' as const,
      label: th.consumerDashboard.mobileNav.scan,
      icon: QrCode,
      isCenter: true,
    },
    {
      view: 'quests' as const,
      label: th.consumerDashboard.mobileNav.quests,
      icon: ClipboardList,
    },
    {
      view: 'rewards' as const,
      label: th.consumerDashboard.mobileNav.coupons,
      icon: Ticket,
    },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 select-none"
      aria-label={th.consumerDashboard.navigation.label}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {items.map((item) => {
          const isActive = activeView === item.view;
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                aria-current={isActive ? 'page' : undefined}
                className="-mt-5 flex flex-col items-center group cursor-pointer"
              >
                <div
                  className={`size-12 sm:size-13 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-[#004494] shadow-blue-600/40'
                      : 'bg-[#0056b3] shadow-blue-500/30 group-hover:bg-[#004494]'
                  }`}
                >
                  <Icon className="size-6 text-white" aria-hidden="true" />
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-bold mt-0.5 ${
                    isActive ? 'text-[#0056b3]' : 'text-slate-600'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 py-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#0056b3] font-bold'
                  : 'text-slate-400 font-medium hover:text-slate-600'
              }`}
            >
              <Icon
                className={`size-5 sm:size-5.5 ${
                  isActive ? 'text-[#0056b3]' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-[10px] sm:text-xs mt-0.5 truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
