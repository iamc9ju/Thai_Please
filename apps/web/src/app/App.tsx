import { AuthProvider } from '../features/auth/components/AuthProvider';
import { useAuth } from '../features/auth/use-auth';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RolePreview } from '../features/auth/pages/RolePreview';
import { ConsumerDashboard } from '../features/consumer/pages/ConsumerDashboard';
import { th } from '../i18n/th';

function MainContent() {
  const { user, isLoading, logout } = useAuth();

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

    if (user.role === 'MERCHANT' || user.role === 'ADMIN') {
      return (
        <RolePreview
          role={user.role === 'MERCHANT' ? 'merchant' : 'administrator'}
          onBack={() => void logout()}
        />
      );
    }
  }

  return <LoginPage />;
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
