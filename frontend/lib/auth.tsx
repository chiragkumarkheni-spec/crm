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
import { istMinutesOfDay } from './format';
import type { User } from './types';

// login resolves to a result so the login page can show a 2FA code box when the
// account has two-factor on.
type LoginResult = { ok: true } | { twoFactorRequired: true; invalidCode: boolean };

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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

  async function login(
    email: string,
    password: string,
    code?: string
  ): Promise<LoginResult> {
    const data = await api.post<{
      token?: string;
      user?: User;
      twoFactorRequired?: boolean;
      invalidCode?: boolean;
    }>('/api/auth/login', { email, password, code, deviceId: getDeviceId() });
    // 2FA is on for this account: ask the login page to collect the code.
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, invalidCode: !!data.invalidCode };
    }
    setToken(data.token as string);
    writeCachedUser(data.user as User);
    setUser(data.user as User);
    router.push('/dashboard');
    return { ok: true };
  }

  const logout = useCallback(() => {
    setToken(null);
    writeCachedUser(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  // Re-pull the signed-in user from the server (e.g. after toggling 2FA) so the
  // cached copy and UI reflect the change.
  const refreshUser = useCallback(async () => {
    try {
      const d = await api.get<{ user: User }>('/api/auth/me');
      setUser(d.user);
      writeCachedUser(d.user);
    } catch {
      /* ignore — keep current user */
    }
  }, []);

  // Auto-logout after a stretch of NO user activity (security: a rep walks away
  // from the office PC). Background polling does NOT count — only real input
  // events (move/click/key/scroll/touch) reset the timer.
  useEffect(() => {
    if (!user) return;
    const TEN_MIN = 10 * 60 * 1000;
    const TWENTY_MIN = 20 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;
    // Office hours are 09:30–19:00 India time (NOT the PC's local time, which may
    // be set wrong — that was logging reps out mid-day on a 10-min strict timeout).
    const inOfficeHours = () => {
      const mins = istMinutesOfDay();
      return mins >= 9 * 60 + 30 && mins < 19 * 60;
    };
    // During office hours admins get 1 hour and reps get 20 minutes of idle
    // time. Outside office hours everyone falls back to the strict 10-minute
    // timeout. Recomputed on each idle check so the window tightens automatically
    // once 19:00 passes.
    const idleMs = () => {
      if (!inOfficeHours()) return TEN_MIN;
      return user.role === 'admin' ? ONE_HOUR : TWENTY_MIN;
    };
    // The input handler does the ABSOLUTE MINIMUM — it only stamps the time of
    // the last activity. This is what keeps a weak/old PC smooth: mousemove and
    // keydown can fire hundreds of times a second, and the previous version armed
    // a fresh setTimeout AND computed the office-hours clock on every single one
    // of those events. Now there is no per-event timer churn and no clock math —
    // a single low-frequency interval (below) does the actual idle check.
    let lastActive = Date.now();
    const mark = () => {
      lastActive = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    // Check idleness every 30s instead of re-arming a timer on each keypress.
    // Worst case the logout fires up to 30s after the threshold — irrelevant for
    // a 10-to-60-minute idle window, and it costs the PC almost nothing.
    const check = setInterval(() => {
      if (Date.now() - lastActive >= idleMs()) logout();
    }, 30000);
    return () => {
      clearInterval(check);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
