import { useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import {
  getConsumerOverview,
  getConsumerSubsidyStatus,
} from '../api/consumer.api';
import type {
  ConsumerOverviewLoadState,
  ConsumerView,
} from '../consumer.types';
import { ConsumerSidebar } from '../components/ConsumerSidebar';
import { ConsumerTopBar } from '../components/ConsumerTopBar';
import { ConsumerOverview } from '../views/ConsumerOverview';
import { OrdersView } from '../views/OrdersView';
import { PaymentView } from '../views/PaymentView';
import { ProfileView } from '../views/ProfileView';
import { QuestsView } from '../views/QuestsView';
import { RewardsView } from '../views/RewardsView';
import { WalletView } from '../views/WalletView';

function overviewErrorState(error: unknown): ConsumerOverviewLoadState {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return { status: 'permission-denied' };
  }

  return { status: 'error' };
}

export type ConsumerDashboardProps = Readonly<{
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [overviewState, setOverviewState] = useState<ConsumerOverviewLoadState>(
    { status: 'loading' },
  );
  const displayName = fullName ?? th.consumerDashboard.displayName;
  const maskedCitizenId = `X-XXXX-${citizenId.slice(-4)}`;

  const retryOverview = async () => {
    setOverviewState({ status: 'loading' });

    try {
      const [data, subsidy] = await Promise.all([
        getConsumerOverview(),
        getConsumerSubsidyStatus(),
      ]);
      setOverviewState({ status: 'success', data, subsidy });
    } catch (error) {
      setOverviewState(overviewErrorState(error));
    }
  };

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([getConsumerOverview(), getConsumerSubsidyStatus()])
      .then(([data, subsidy]) => {
        if (isCurrent) {
          setOverviewState({ status: 'success', data, subsidy });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setOverviewState(overviewErrorState(error));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const navigate = (view: ConsumerView) => {
    setActiveView(view);
    setAnnouncement('');
    setIsMobileOpen(false);
  };

  const announcePrototypeAction = () =>
    setAnnouncement(th.consumerPortal.common.mockNotice);

  return (
    <div className="min-h-screen bg-slate-50/70 flex font-sans text-slate-900">
      {/* Left Sidebar Navigation (Unified Theme) */}
      <ConsumerSidebar
        activeView={activeView}
        displayName={displayName}
        maskedCitizenId={maskedCitizenId}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onNavigate={navigate}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConsumerTopBar
          activeView={activeView}
          displayName={displayName}
          onOpenMobile={() => setIsMobileOpen(true)}
          onNavigate={navigate}
          onNotification={announcePrototypeAction}
          onOpenProfile={() => navigate('profile')}
          onLogout={onLogout}
        />

        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1800px] mx-auto"
          id="dashboard-top"
        >
          {activeView !== 'overview' &&
            activeView !== 'wallet' &&
            activeView !== 'quests' && (
              <div className="draft-banner mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-sm flex items-center justify-between shadow-xs">
                <span className="font-bold">
                  {th.consumerPortal.draftLabel}
                </span>
                <p aria-live="polite" className="text-amber-700 font-medium">
                  {announcement}
                </p>
              </div>
            )}

          {activeView === 'overview' && (
            <ConsumerOverview
              displayName={displayName}
              maskedCitizenId={maskedCitizenId}
              announcement={announcement}
              overviewState={overviewState}
              onNavigate={navigate}
              onRetry={() => void retryOverview()}
            />
          )}

          {activeView === 'wallet' && <WalletView />}
          {activeView === 'payment' && (
            <PaymentView
              onNavigate={navigate}
              availableCoupons={
                overviewState.status === 'success'
                  ? overviewState.data.coupons
                  : []
              }
              onPaymentSuccess={() => void retryOverview()}
            />
          )}
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
        </main>
      </div>
    </div>
  );
}
