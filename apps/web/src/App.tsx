import { AuthProvider, useAuth } from './context/auth.context';
import { ConsumerDashboard } from './consumer/ConsumerDashboard';
import { LoginPage } from './login/LoginPage';
import { RolePreview } from './login/RolePreview';

function MainContent() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="text-sm text-slate-400">กำลังตรวจสอบข้อมูลผู้ใช้งาน...</p>
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
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
