import type { AppConfigResponse } from '@cymis/schemas';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { endpoints } from '@/api/endpoints';
import { kv } from '@/lib/kv';

// Settings the server can change without a new release: block a broken old
// version, nudge people to update, switch a feature off, or show a notice.
// The last copy is kept, so a phone with no signal still follows it.

const CACHE_KEY = 'cymis.app-config';
const REFRESH_AFTER_MS = 15 * 60_000;

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

interface ConfigState {
  config: AppConfigResponse | null;
  /** Notice text the person closed, so it stays closed until the text changes. */
  dismissedNotice: string | null;
  dismissedUpdate: string | null;
  loadedAt: number;
}

export const useAppConfig = create<ConfigState>(() => ({ config: null, dismissedNotice: null, dismissedUpdate: null, loadedAt: 0 }));

/** Compares "1.2.10" and "1.3.0" the way people expect. */
export function olderThan(a: string, b: string) {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

async function load() {
  try {
    const config = await endpoints.appConfig();
    useAppConfig.setState({ config, loadedAt: Date.now() });
    try {
      kv.set(CACHE_KEY, JSON.stringify(config));
    } catch {
      // Not saving is fine; it loads again next launch.
    }
  } catch {
    // No signal or the server is down: keep whatever we had.
  }
}

let started = false;

/** Reads the cached copy, then fetches a fresh one. Call once at start up. */
export function startAppConfig() {
  if (started) return;
  started = true;
  try {
    const raw = kv.get(CACHE_KEY);
    if (raw) useAppConfig.setState({ config: JSON.parse(raw) as AppConfigResponse });
  } catch {
    // A broken cache is ignored; the fetch replaces it.
  }
  void load();
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && Date.now() - useAppConfig.getState().loadedAt > REFRESH_AFTER_MS) void load();
  });
}

/** Is a feature switched on. Missing from the server means on. */
export function useFeature(name: string) {
  return useAppConfig((s) => s.config?.features[name] !== false);
}

/** What the update gate should show. */
export function useUpdateState(): 'blocked' | 'available' | 'current' {
  return useAppConfig((s) => {
    const c = s.config;
    if (!c) return 'current';
    if (olderThan(APP_VERSION, c.minVersion)) return 'blocked';
    // The web build is always the newest one the server has, so it never nags.
    if (Platform.OS !== 'web' && olderThan(APP_VERSION, c.latestVersion) && s.dismissedUpdate !== c.latestVersion) return 'available';
    return 'current';
  });
}
