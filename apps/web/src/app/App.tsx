import { lazy, Suspense, useState } from 'react';
import { BrandLoadingScreen } from '../components/BrandLoadingScreen';
import { ToastProvider } from '../components/toast';
import { AuthProvider } from '../features/auth/components/AuthProvider';
import { useAuth } from '../features/auth/use-auth';
import { LandingPage } from '../features/landing/pages/LandingPage';
import { th } from '../i18n/th';

const LoginPage = lazy(async () => {
  const mod = await import('../features/auth/pages/LoginPage');
  return { default: mod.LoginPage };
});

const AdminDashboard = lazy(async () => {
  const mod = await import('../features/admin/pages/AdminDashboard');
  return { default: mod.AdminDashboard };
});

const ConsumerDashboard = lazy(async () => {
  const mod = await import('../features/consumer/pages/ConsumerDashboard');
  return { default: mod.ConsumerDashboard };
});

const MerchantPos = lazy(async () => {
  const mod = await import('../features/merchant/pages/MerchantPos');
  return { default: mod.MerchantPos };
});

const MerchantPendingApproval = lazy(async () => {
  const mod = await import(
    '../features/merchant/pages/MerchantPendingApproval'
  );
  return { default: mod.MerchantPendingApproval };
});

function PortalLoadingFallback() {
  return (
    <BrandLoadingScreen
      label={th.app.checkingSession}
      sublabel={th.app.checkingSessionSub}
    />
  );
}

function MainContent() {
  const { user, isLoading, logout, refreshSession } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading) {
    return <PortalLoadingFallback />;
  }

  if (user) {
    if (user.role === 'CONSUMER') {
      return (
        <Suspense fallback={<PortalLoadingFallback />}>
          <ConsumerDashboard
            citizenId={user.citizenId}
            fullName={user.fullName}
            onLogout={() => void logout()}
          />
        </Suspense>
      );
    }

    if (user.role === 'MERCHANT') {
      const isApproved = user.merchantStatus === 'ACTIVE';

      if (!isApproved) {
        return (
          <Suspense fallback={<PortalLoadingFallback />}>
            <MerchantPendingApproval
              merchantName={
                user.merchantName ?? user.fullName ?? 'ร้านค้าของฉัน'
              }
              citizenId={user.citizenId}
              status={user.merchantStatus ?? 'PENDING'}
              merchantRole={user.merchantRole ?? 'OWNER'}
              onRefresh={() => void refreshSession()}
              onLogout={() => void logout()}
            />
          </Suspense>
        );
      }

      return (
        <Suspense fallback={<PortalLoadingFallback />}>
          <MerchantPos
            merchantName={
              user.merchantName ?? user.fullName ?? 'ร้านค้าคนละครึ่ง'
            }
            merchantRole={user.merchantRole ?? 'OWNER'}
            fullName={user.fullName}
            citizenId={user.citizenId}
            onLogout={() => void logout()}
          />
        </Suspense>
      );
    }

    if (user.role === 'ADMIN') {
      return (
        <Suspense fallback={<PortalLoadingFallback />}>
          <AdminDashboard
            adminName={user.fullName ?? 'ผู้ดูแลระบบกลาง'}
            onLogout={() => void logout()}
          />
        </Suspense>
      );
    }
  }

  if (showLogin) {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <LoginPage onBack={() => setShowLogin(false)} />
      </Suspense>
    );
  }

  return <LandingPage onLogin={() => setShowLogin(true)} />;
}

function App() {
  const isCustomerPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === 'customer';

  if (isCustomerPreview) {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <ConsumerDashboard
          citizenId="1100000000001"
          fullName={th.consumerDashboard.displayName}
          onLogout={() => window.history.replaceState({}, '', '/')}
        />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
