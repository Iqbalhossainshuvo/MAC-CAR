import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, isConfigured, loadToken, setOnAuthLost, setToken } from './api';
import type { Profile } from './types';

interface Session {
  token: string;
  user: Profile;
}

interface AuthState {
  loading: boolean;
  user: Profile | null;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signInWithGoogle: (credential: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setUser: (u: Profile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnAuthLost(() => {
      signOut();
    });
    (async () => {
      try {
        if (isConfigured && (await loadToken())) {
          setUser(await api<Profile>('me'));
        }
      } catch {
        await setToken(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => setOnAuthLost(null);
  }, [signOut]);

  const finish = async (p: Promise<Session>): Promise<string | null> => {
    try {
      const s = await p;
      await setToken(s.token);
      setUser(s.user);
      return null;
    } catch (e: any) {
      return e?.message ?? String(e);
    }
  };

  const signIn = useCallback((username: string, password: string) => finish(api<Session>('login', { username, password })), []);
  const signInWithGoogle = useCallback((credential: string) => finish(api<Session>('googleLogin', { credential })), []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      isAdmin: user?.role === 'admin',
      signIn,
      signInWithGoogle,
      signOut,
      setUser,
    }),
    [loading, user, signIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
