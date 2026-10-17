import { useState } from 'react';
import { AuthProvider } from '../features/auth/components/AuthProvider';
import { useAuth } from '../features/auth/use-auth';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { AdminDashboard } from '../features/admin/pages/AdminDashboard';
import { ConsumerDashboard } from '../features/consumer/pages/ConsumerDashboard';
import { MerchantPos } from '../features/merchant/pages/MerchantPos';
import { LandingPage } from '../features/landing/pages/LandingPage';
import { th } from '../i18n/th';

function MainContent() {
  const { user, isLoading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="text-sm text-slate-400">{th.app.checkingSession}</p>
        </div>
      </div>
    );
  }

  if (user) {
    if (user.role === 'CONSUMER') {
      return (
        <ConsumerDashboard
          citizenId={user.citizenId}
          fullName={user.fullName}
          onLogout={() => void logout()}
        />
      );
    }

    if (user.role === 'MERCHANT') {
      return (
        <MerchantPos
          merchantName={user.fullName ?? 'ร้านค้าคนละครึ่ง'}
          onLogout={() => void logout()}
        />
      );
    }

    if (user.role === 'ADMIN') {
      return (
        <AdminDashboard
          adminName={user.fullName ?? 'ผู้ดูแลระบบกลาง'}
          onLogout={() => void logout()}
        />
      );
    }
  }

  if (showLogin) {
    return <LoginPage onBack={() => setShowLogin(false)} />;
  }

  return <LandingPage onLogin={() => setShowLogin(true)} />;
}

function App() {
  const isCustomerPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === 'customer';

  if (isCustomerPreview) {
    return (
      <ConsumerDashboard
        citizenId="1100000000001"
        fullName={th.consumerDashboard.displayName}
        onLogout={() => window.history.replaceState({}, '', '/')}
      />
    );
  }

  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
