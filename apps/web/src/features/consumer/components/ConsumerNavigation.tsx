import {
  CircleUserRound,
  ClipboardList,
  Home,
  QrCode,
  Sparkles,
  TicketPercent,
  WalletCards,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

type ConsumerNavigationProps = Readonly<{
  activeView: ConsumerView;
  onNavigate: (view: ConsumerView) => void;
}>;

const items = [
  { view: 'overview', label: th.consumerPortal.navigation.overview, icon: Home },
  { view: 'wallet', label: th.consumerPortal.navigation.wallet, icon: WalletCards },
  { view: 'payment', label: th.consumerPortal.navigation.payment, icon: QrCode },
  { view: 'orders', label: th.consumerPortal.navigation.orders, icon: ClipboardList },
  { view: 'quests', label: th.consumerPortal.navigation.quests, icon: Sparkles },
  { view: 'rewards', label: th.consumerPortal.navigation.rewards, icon: TicketPercent },
  { view: 'profile', label: th.consumerPortal.navigation.profile, icon: CircleUserRound },
] as const;

export function ConsumerNavigation({ activeView, onNavigate }: ConsumerNavigationProps) {
  return (
    <nav className="consumer-desktop-nav" aria-label={th.consumerDashboard.navigation.label}>
      {items.map(({ view, label, icon: Icon }) => (
        <button
          aria-current={activeView === view ? 'page' : undefined}
          className={activeView === view ? 'is-active' : undefined}
          key={view}
          onClick={() => onNavigate(view)}
          type="button"
        >
          <Icon aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
