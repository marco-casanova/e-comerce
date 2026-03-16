import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { setAccessTokenProvider } from "../api/httpClient";
import { reportError } from "../monitoring/errorReporter";
import { setObservedUser } from "../monitoring/observability";
import type { LoginResponse } from "../../features/auth/types";
import {
  clearStoredSession,
  persistSession,
  readStoredSession,
} from "./authStorage";

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
      try {
        const storedSession = await readStoredSession();
        setAccessTokenProvider(() => storedSession?.accessToken ?? null);

        if (isMounted) {
          setSession(storedSession);
        }
      } catch (error) {
        reportError(error, {
          domain: "auth",
          action: "hydrateSession",
        });

        setAccessTokenProvider(() => null);
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setObservedUser(null);
      return;
    }

    setObservedUser({
      id: session.user.id,
      email: session.user.email,
      roles: session.user.roles,
    });
  }, [session]);

  async function signIn(nextSession: LoginResponse) {
    try {
      setAccessTokenProvider(() => nextSession.accessToken);
      await persistSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      reportError(error, {
        domain: "auth",
        action: "signIn",
        details: { userId: nextSession.user.id },
      });
      throw error;
    }
  }

  async function signOut() {
    try {
      setAccessTokenProvider(() => null);
      await clearStoredSession();
      setSession(null);
    } catch (error) {
      reportError(error, {
        domain: "auth",
        action: "signOut",
      });
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ session, isHydrating, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
