import { useEffect, useState } from 'react';
import { th } from '../../../i18n/th';
import { ApiError } from '../../../lib/api-client';
import { getConsumerOverview } from '../api/consumer.api';
import type {
  ConsumerOverviewLoadState,
  ConsumerView,
} from '../consumer.types';
import { ConsumerMobileNav } from '../components/ConsumerMobileNav';
import { ConsumerSidebar } from '../components/ConsumerSidebar';
import { ConsumerTopBar } from '../components/ConsumerTopBar';
import { ConsumerOverview } from '../views/ConsumerOverview';
import { CouponsView } from '../views/CouponsView';
import { OrdersView } from '../views/OrdersView';
import { PaymentView } from '../views/PaymentView';
import { ProfileView } from '../views/ProfileView';
import { QuestsView } from '../views/QuestsView';
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
      const data = await getConsumerOverview();
      setOverviewState({ status: 'success', data });
    } catch (error) {
      setOverviewState(overviewErrorState(error));
    }
  };

  useEffect(() => {
    let isCurrent = true;

    void getConsumerOverview()
      .then((data) => {
        if (isCurrent) {
          setOverviewState({ status: 'success', data });
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
          onOpenProfile={() => navigate('profile')}
          onLogout={onLogout}
        />

        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 w-full"
          id="dashboard-top"
        >
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
          {activeView === 'rewards' && (
            <CouponsView
              onNavigate={navigate}
              onCouponRedeemed={() => void retryOverview()}
            />
          )}
          {activeView === 'profile' && <ProfileView />}
        </main>
      </div>

      {/* Mobile & Tablet Bottom Navigation Bar */}
      <ConsumerMobileNav activeView={activeView} onNavigate={navigate} />
    </div>
  );
}
