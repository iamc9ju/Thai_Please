import { lazy, Suspense, useState } from 'react';
import { BrandLoadingScreen } from '../components/BrandLoadingScreen';
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog';
import { ToastProvider } from '../components/toast';
import { AuthProvider } from '../features/auth/components/AuthProvider';
import { useAuth } from '../features/auth/use-auth';
import type { LoginRole } from '../features/auth/auth.types';
import type { RegistrationRole } from '../features/registration/registration.validation';
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loginRole, setLoginRole] = useState<LoginRole | undefined>();
  const [registrationRole, setRegistrationRole] =
    useState<RegistrationRole | null>(null);

  const handleRequestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    void logout();
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  if (isLoading) {
    return <PortalLoadingFallback />;
  }

  if (user) {
    let dashboardContent = null;

    if (user.role === 'CONSUMER') {
      dashboardContent = (
        <ConsumerDashboard
          citizenId={user.citizenId}
          fullName={user.fullName}
          onLogout={handleRequestLogout}
        />
      );
    } else if (user.role === 'MERCHANT') {
      const isApproved = user.merchantStatus === 'ACTIVE';

      if (!isApproved) {
        dashboardContent = (
          <MerchantPendingApproval
            merchantName={
              user.merchantName ?? user.fullName ?? 'ร้านค้าของฉัน'
            }
            citizenId={user.citizenId}
            status={user.merchantStatus ?? 'PENDING'}
            merchantRole={user.merchantRole ?? 'OWNER'}
            onRefresh={() => void refreshSession()}
            onLogout={handleRequestLogout}
          />
        );
      } else {
        dashboardContent = (
          <MerchantPos
            merchantName={
              user.merchantName ?? user.fullName ?? 'ร้านค้าคนละครึ่ง'
            }
            merchantRole={user.merchantRole ?? 'OWNER'}
            fullName={user.fullName}
            citizenId={user.citizenId}
            onLogout={handleRequestLogout}
          />
        );
      }
    } else if (user.role === 'ADMIN') {
      dashboardContent = (
        <AdminDashboard
          adminName={user.fullName ?? 'ผู้ดูแลระบบกลาง'}
          onLogout={handleRequestLogout}
        />
      );
    }

    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        {dashboardContent}
        <LogoutConfirmDialog
          isOpen={showLogoutConfirm}
          onConfirm={handleConfirmLogout}
          onCancel={handleCancelLogout}
        />
      </Suspense>
    );
  }

  if (showLogin) {
    return (
      <Suspense fallback={<PortalLoadingFallback />}>
        <LoginPage
          onBack={() => {
            setShowLogin(false);
            setRegistrationRole(null);
          }}
          initialRole={loginRole}
          initialRegistrationRole={registrationRole}
        />
      </Suspense>
    );
  }

  return (
    <LandingPage
      onLogin={() => {
        setLoginRole(undefined);
        setRegistrationRole(null);
        setShowLogin(true);
      }}
      onLoginConsumer={() => {
        setLoginRole('consumer');
        setRegistrationRole(null);
        setShowLogin(true);
      }}
      onLoginMerchant={() => {
        setLoginRole('merchant');
        setRegistrationRole(null);
        setShowLogin(true);
      }}
      onRegisterConsumer={() => {
        setLoginRole('consumer');
        setRegistrationRole('consumer');
        setShowLogin(true);
      }}
      onRegisterMerchant={() => {
        setLoginRole('merchant');
        setRegistrationRole('merchant');
        setShowLogin(true);
      }}
    />
  );
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
