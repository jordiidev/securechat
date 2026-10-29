import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setUnauthorizedHandler } from '../../shared/http';
import * as authService from './authService';
import type { AuthenticatedSession } from './authService';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; session: AuthenticatedSession };

interface AuthContextValue {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const authenticate = useCallback((session: AuthenticatedSession) => {
    setState({ status: 'authenticated', session });
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ status: 'anonymous' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    authService
      .resumeSession()
      .then((session) => {
        if (!cancelled) setState(session ? { status: 'authenticated', session } : { status: 'anonymous' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      logout,
      login: async (username, password) => authenticate(await authService.login(username, password)),
      register: async (username, password) =>
        authenticate(await authService.register(username, password)),
    }),
    [state, logout, authenticate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
