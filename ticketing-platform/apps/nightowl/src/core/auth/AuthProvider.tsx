import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import { setAccessTokenProvider } from '../api/httpClient';
import type { LoginResponse } from '../../features/auth/types';
import { clearStoredSession, persistSession, readStoredSession } from './authStorage';

type AuthSession = LoginResponse | null;

type AuthContextValue = {
  session: AuthSession;
  isHydrating: boolean;
  signIn: (session: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const storedSession = await readStoredSession();
      setAccessTokenProvider(() => storedSession?.accessToken ?? null);

      if (isMounted) {
        setSession(storedSession);
        setIsHydrating(false);
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function signIn(nextSession: LoginResponse) {
    setAccessTokenProvider(() => nextSession.accessToken);
    await persistSession(nextSession);
    setSession(nextSession);
  }

  async function signOut() {
    setAccessTokenProvider(() => null);
    await clearStoredSession();
    setSession(null);
  }

  return <AuthContext.Provider value={{ session, isHydrating, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
