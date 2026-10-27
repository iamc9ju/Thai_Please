import { lazy, Suspense, useState } from 'react';
import { LoadingState } from '../components/LoadingState';
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

function PortalLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <LoadingState label={th.app.checkingSession} />
    </div>
  );
}

function MainContent() {
  const { user, isLoading, logout } = useAuth();
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
      return (
        <Suspense fallback={<PortalLoadingFallback />}>
          <MerchantPos
            merchantName={user.fullName ?? 'ร้านค้าคนละครึ่ง'}
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
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
