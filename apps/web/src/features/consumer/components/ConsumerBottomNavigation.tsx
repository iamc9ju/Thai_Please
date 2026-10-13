import {
  CircleUserRound,
  Home,
  QrCode,
  ReceiptText,
  TicketPercent,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import type { ConsumerView } from '../consumer.types';

type ConsumerBottomNavigationProps = Readonly<{
  activeView: ConsumerView;
  onNavigate: (view: ConsumerView) => void;
}>;

export function ConsumerBottomNavigation({
  activeView,
  onNavigate,
}: ConsumerBottomNavigationProps) {
  return (
    <nav
      className="consumer-bottom-nav"
      aria-label={th.consumerDashboard.navigation.label}
    >
      <button
        className={activeView === 'overview' ? 'is-active' : undefined}
        onClick={() => onNavigate('overview')}
        type="button"
      >
        <Home aria-hidden="true" />
        {th.consumerPortal.navigation.overview}
      </button>
      <button
        className={activeView === 'orders' ? 'is-active' : undefined}
        onClick={() => onNavigate('orders')}
        type="button"
      >
        <ReceiptText aria-hidden="true" />
        {th.consumerPortal.navigation.orders}
      </button>
      <button
        className={activeView === 'payment' ? 'is-active' : undefined}
        onClick={() => onNavigate('payment')}
        type="button"
      >
        <QrCode aria-hidden="true" />
        {th.consumerPortal.navigation.payment}
      </button>
      <button
        className={activeView === 'rewards' ? 'is-active' : undefined}
        onClick={() => onNavigate('rewards')}
        type="button"
      >
        <TicketPercent aria-hidden="true" />
        {th.consumerPortal.navigation.rewards}
      </button>
      <button
        className={activeView === 'profile' ? 'is-active' : undefined}
        onClick={() => onNavigate('profile')}
        type="button"
      >
        <CircleUserRound aria-hidden="true" />
        {th.consumerPortal.navigation.profile}
      </button>
    </nav>
  );
}
