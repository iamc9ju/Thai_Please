import { Bell, CircleUserRound, HandHeart, LogOut } from 'lucide-react';
import { th } from '../../../i18n/th';

type ConsumerHeaderProps = Readonly<{
  displayName: string;
  maskedCitizenId: string;
  onLogout: () => void;
  onPrototypeAction: () => void;
}>;

export function ConsumerHeader({
  displayName,
  maskedCitizenId,
  onLogout,
  onPrototypeAction,
}: ConsumerHeaderProps) {
  return (
    <header className="consumer-header">
      <a className="consumer-brand" href="#dashboard-top">
        <span aria-hidden="true" className="consumer-brand-mark">
          <HandHeart />
        </span>
        <span>
          <strong>{th.consumerDashboard.brand}</strong>
          <small>{th.consumerDashboard.prototype}</small>
        </span>
      </a>
      <div className="consumer-header-actions">
        <button
          aria-label={th.consumerDashboard.notification}
          className="consumer-icon-button"
          onClick={onPrototypeAction}
          type="button"
        >
          <Bell aria-hidden="true" />
          <span aria-hidden="true" className="notification-dot" />
        </button>
        <div className="consumer-profile-summary">
          <span aria-hidden="true" className="profile-avatar">
            <CircleUserRound />
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>{maskedCitizenId}</small>
          </span>
        </div>
        <button className="logout-button" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" />
          {th.consumerDashboard.logout}
        </button>
      </div>
    </header>
  );
}
