import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth.api';
import { AuthContext } from '../auth-context';
import type { AuthUser, LoginCredentials, LoginRole } from '../auth.types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    await refreshSession();
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
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
