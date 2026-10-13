import { useState } from 'react';
import { th } from '../../../i18n/th';
import { ConsumerBottomNavigation } from '../components/ConsumerBottomNavigation';
import { ConsumerHeader } from '../components/ConsumerHeader';
import { ConsumerNavigation } from '../components/ConsumerNavigation';
import type { ConsumerView } from '../consumer.types';
import { ConsumerOverview } from '../views/ConsumerOverview';
import { OrdersView } from '../views/OrdersView';
import { PaymentView } from '../views/PaymentView';
import { ProfileView } from '../views/ProfileView';
import { QuestsView } from '../views/QuestsView';
import { RewardsView } from '../views/RewardsView';
import { WalletView } from '../views/WalletView';

type ConsumerDashboardProps = Readonly<{
  citizenId: string;
  fullName?: string;
  onLogout: () => void;
}>;

export function ConsumerDashboard({
  citizenId,
  fullName,
  onLogout,
}: ConsumerDashboardProps) {
  const [activeView, setActiveView] = useState<ConsumerView>('overview');
  const [announcement, setAnnouncement] = useState('');
  const displayName = fullName ?? th.consumerDashboard.displayName;
  const maskedCitizenId = `X-XXXX-${citizenId.slice(-4)}`;

  const navigate = (view: ConsumerView) => {
    setActiveView(view);
    setAnnouncement('');
  };

  const announcePrototypeAction = () =>
    setAnnouncement(th.consumerPortal.common.mockNotice);

  return (
    <main className="consumer-shell">
      <ConsumerHeader
        displayName={displayName}
        maskedCitizenId={maskedCitizenId}
        onLogout={onLogout}
        onNotification={announcePrototypeAction}
        onOpenProfile={() => navigate('profile')}
      />
      <ConsumerNavigation activeView={activeView} onNavigate={navigate} />
      <div className="consumer-content" id="dashboard-top">
        <div className="draft-banner">
          <span>{th.consumerPortal.draftLabel}</span>
          <p aria-live="polite">{announcement}</p>
        </div>
        {activeView === 'overview' && (
          <ConsumerOverview
            displayName={displayName}
            announcement={announcement}
            onNavigate={navigate}
          />
        )}
        {activeView === 'wallet' && <WalletView />}
        {activeView === 'payment' && <PaymentView onNavigate={navigate} />}
        {activeView === 'orders' && <OrdersView />}
        {activeView === 'quests' && <QuestsView />}
        {activeView === 'rewards' && <RewardsView />}
        {activeView === 'profile' && (
          <ProfileView
            displayName={displayName}
            maskedCitizenId={maskedCitizenId}
            onPrototypeAction={announcePrototypeAction}
          />
        )}
      </div>
      <ConsumerBottomNavigation activeView={activeView} onNavigate={navigate} />
    </main>
  );
}
