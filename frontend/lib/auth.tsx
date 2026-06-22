'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, getToken } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// We cache the signed-in user in localStorage so the app can paint instantly on
// a fresh open instead of blocking on a (possibly cold) /api/auth/me request.
// This is only a UI convenience: every API call is still authorised server-side
// from the JWT, so a tampered cached user cannot grant any real access — it is
// corrected the moment the background revalidation below runs.
const USER_KEY = 'nexton_user';
const DEVICE_KEY = 'nexton_device';

// A stable per-PC id kept in this browser's localStorage. A rep's account binds
// to it on first login, so the login then works only from this one PC.
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Fast path: if we have a cached user, show the app immediately and verify
    // the session in the background. Slow path (no cache): wait for the server.
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    api
      .get<{ user: User }>('/api/auth/me')
      .then((d) => {
        setUser(d.user);
        writeCachedUser(d.user);
      })
      .catch(() => {
        // Token is invalid/expired — clear everything and fall back to login.
        setToken(null);
        writeCachedUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>(
      '/api/auth/login',
      { email, password, deviceId: getDeviceId() }
    );
    setToken(data.token);
    writeCachedUser(data.user);
    setUser(data.user);
    router.push('/dashboard');
  }

  const logout = useCallback(() => {
    setToken(null);
    writeCachedUser(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  // Auto-logout after a stretch of NO user activity (security: a rep walks away
  // from the office PC). Background polling does NOT count — only real input
  // events (move/click/key/scroll/touch) reset the timer.
  useEffect(() => {
    if (!user) return;
    const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
