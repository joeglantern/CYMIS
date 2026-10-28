import type { AuthResponse, Me } from '@cymis/schemas';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { api, ApiError, IS_WEB, setTokenSource } from '@/api/http';
import { kv } from '@/lib/kv';
import { useLastVisit } from '@/state/lastVisit';
import { secureToken } from './secure';

export type SessionStatus = 'loading' | 'signedOut' | 'locked' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: Me | null;
  /** Signed in from the cached profile with no signal. Scans queue until a token comes back. */
  offline: boolean;
}

interface CachedProfile {
  user: Me;
  savedAt: string;
}

const PROFILE_KEY = 'cymis.profile';
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

export const useSession = create<SessionState>(() => ({ status: 'loading', user: null, offline: false }));

function cacheProfile(user: Me) {
  if (IS_WEB) return;
  kv.set(PROFILE_KEY, JSON.stringify({ user, savedAt: new Date().toISOString() } satisfies CachedProfile));
}

/** The last person who signed in on this phone, for the Welcome back screen. */
export function cachedProfile(): Me | null {
  const raw = kv.get(PROFILE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as CachedProfile).user;
  } catch {
    return null;
  }
}

/** "Chrome on Windows", so people can tell their sessions apart. */
function browserLabel() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return system ? `${browser} on ${system}` : browser;
}

function deviceLabel() {
  if (IS_WEB) return browserLabel();
  const name = Constants.deviceName ?? (Platform.OS === 'ios' ? 'iPhone or iPad' : 'Android device');
  return name.slice(0, 100);
}

async function accept(res: AuthResponse) {
  accessToken = res.accessToken;
  if (res.refreshToken) await secureToken.set(res.refreshToken);
  cacheProfile(res.user);
  useSession.setState({ status: 'signedIn', user: res.user, offline: false });
}

/** One refresh at a time. Refresh tokens rotate, so two at once would end the session. */
function refreshOnce(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const stored = IS_WEB ? undefined : await secureToken.get();
      if (!IS_WEB && !stored) return null;
      const call = () =>
        api<AuthResponse>('/auth/refresh', {
          method: 'POST',
          body: stored ? { refreshToken: stored } : {},
          anonymous: true,
        });
      // Browser tabs share one refresh cookie, and each refresh replaces it.
      // Take turns, so two tabs never send the same cookie at once; the one
      // that waits sends the fresh cookie the first one got back.
      const locks = IS_WEB && typeof navigator !== 'undefined' ? (navigator as { locks?: { request: <T>(name: string, cb: () => Promise<T>) => Promise<T> } }).locks : undefined;
      const res = locks ? await locks.request('cymis-refresh', call) : await call();
      await accept(res);
      return res.accessToken;
    } catch (err) {
      if (err instanceof ApiError && err.offline) throw err;
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

setTokenSource({
  getAccessToken: () => accessToken,
  refresh: async () => {
    try {
      return await refreshOnce();
    } catch {
      return null;
    }
  },
  onSessionEnded: () => {
    void endSession();
  },
});

async function endSession() {
  accessToken = null;
  await secureToken.clear();
  useSession.setState({ status: 'signedOut', user: null, offline: false });
}

export const session = {
  /** Called once at start up. */
  async restore(): Promise<void> {
    if (IS_WEB) {
      try {
        const token = await refreshOnce();
        if (!token) useSession.setState({ status: 'signedOut' });
      } catch {
        useSession.setState({ status: 'signedOut' });
      }
      return;
    }
    const [stored, profile] = [await secureToken.get(), cachedProfile()];
    useSession.setState(stored && profile ? { status: 'locked', user: profile } : { status: 'signedOut', user: profile });
  },

  async signIn(staffId: string, password: string): Promise<Me> {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { staffId, password, client: IS_WEB ? 'web' : 'mobile', deviceLabel: deviceLabel() },
      anonymous: true,
    });
    await accept(res);
    if (res.previousSignIn) useLastVisit.setState({ previous: res.previousSignIn });
    return res.user;
  },

  /**
   * After Face ID or fingerprint. Gets a fresh token if there is signal. With
   * no signal the crew can still open audits they already downloaded and scan.
   */
  async unlock(): Promise<void> {
    try {
      const token = await refreshOnce();
      if (!token) await endSession();
    } catch {
      const profile = cachedProfile();
      if (!profile) return endSession();
      useSession.setState({ status: 'signedIn', user: profile, offline: true });
    }
  },

  /** Put the app behind the unlock screen again, keeping the stored session. */
  lock() {
    if (IS_WEB) return;
    accessToken = null;
    const s = useSession.getState();
    if (s.status === 'signedIn') useSession.setState({ status: 'locked' });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword, client: IS_WEB ? 'web' : 'mobile' },
    });
    await accept(res);
  },

  async signOut(): Promise<void> {
    const stored = await secureToken.get();
    try {
      await api('/auth/logout', { method: 'POST', body: stored ? { refreshToken: stored } : {}, anonymous: !IS_WEB });
    } catch {
      // Signing out works offline too. The server token expires on its own.
    }
    if (!IS_WEB) kv.remove(PROFILE_KEY);
    await endSession();
  },

  /** Retry getting a token after an offline unlock, when signal comes back. */
  async reconnect(): Promise<boolean> {
    if (!useSession.getState().offline) return true;
    try {
      return !!(await refreshOnce());
    } catch {
      return false;
    }
  },
};

export function hasAccessToken() {
  return accessToken !== null;
}

/** For the socket handshake. Refreshes first if the token is missing. */
export async function socketToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  try {
    return await refreshOnce();
  } catch {
    return null;
  }
}
