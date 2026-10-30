import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '../../../components/toast';
import { th } from '../../../i18n/th';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth.api';
import { AuthContext } from '../auth-context';
import type { AuthUser, LoginCredentials, LoginRole } from '../auth.types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const refreshSession = useCallback(async () => {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Session restoration is an external synchronization and must update auth state.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  const handleLogin = async (
    role: LoginRole,
    credentials: LoginCredentials,
  ) => {
    await apiLogin(role, credentials);
    try {
      const currentUser = await getMe();
      setUser(currentUser);

      if (currentUser) {
        const roleLabel =
          role === 'merchant'
            ? th.authToast.roles.merchant
            : role === 'administrator'
              ? th.authToast.roles.admin
              : th.authToast.roles.consumer;

        const displayName =
          currentUser.merchantName ?? currentUser.fullName ?? 'ผู้ใช้งาน';

        showToast({
          type: 'login-success',
          title: th.authToast.loginSuccessTitle,
          description: th.authToast.loginSuccessDesc(displayName, roleLabel),
          badge: roleLabel,
          duration: 4500,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      showToast({
        type: 'logout-success',
        title: th.authToast.logoutSuccessTitle,
        description: th.authToast.logoutSuccessDesc,
        badge: 'ระบบ',
        duration: 4000,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login: handleLogin,
        logout: handleLogout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
