import {
  CircleUserRound,
  Home,
  ReceiptText,
  Sparkles,
  TicketPercent,
} from 'lucide-react';
import { th } from '../../../i18n/th';

type ConsumerBottomNavigationProps = Readonly<{
  onPrototypeAction: () => void;
}>;

export function ConsumerBottomNavigation({
  onPrototypeAction,
}: ConsumerBottomNavigationProps) {
  return (
    <nav
      className="consumer-bottom-nav"
      aria-label={th.consumerDashboard.navigation.label}
    >
      <button className="is-active" type="button">
        <Home aria-hidden="true" />
        {th.consumerDashboard.navigation.home}
      </button>
      <button onClick={onPrototypeAction} type="button">
        <ReceiptText aria-hidden="true" />
        {th.consumerDashboard.navigation.orders}
      </button>
      <button onClick={onPrototypeAction} type="button">
        <Sparkles aria-hidden="true" />
        {th.consumerDashboard.navigation.quests}
      </button>
      <button onClick={onPrototypeAction} type="button">
        <TicketPercent aria-hidden="true" />
        {th.consumerDashboard.navigation.coupons}
      </button>
      <button onClick={onPrototypeAction} type="button">
        <CircleUserRound aria-hidden="true" />
        {th.consumerDashboard.navigation.profile}
      </button>
    </nav>
  );
}
