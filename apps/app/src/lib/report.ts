import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { APP_VERSION } from '@/state/appConfig';

// Crash reports go to our own server log, with the build they came from.
// Only the error itself is sent: never form input, scans or tokens.

const seen = new Map<string, number>();
const SAME_ERROR_GAP_MS = 60_000;

export function reportError(err: unknown, screen?: string) {
  const e = err instanceof Error ? err : new Error(String(err));
  const key = `${e.message}|${screen ?? ''}`;
  const last = seen.get(key) ?? 0;
  // One report per error per minute, so a render loop cannot flood the server.
  if (Date.now() - last < SAME_ERROR_GAP_MS) return;
  seen.set(key, Date.now());

  void endpoints
    .clientError({
      message: e.message.slice(0, 500) || 'Unknown error',
      ...(e.stack ? { stack: e.stack.slice(0, 4000) } : {}),
      ...(screen ? { screen: screen.slice(0, 200) } : {}),
      appVersion: APP_VERSION,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      ...(Updates.updateId ? { updateId: Updates.updateId } : {}),
    })
    .catch(() => undefined);
}

let installed = false;

/** Catches errors that escape every screen. Call once at start up. */
export function installCrashReporting() {
  if (installed) return;
  installed = true;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message, window.location.pathname));
    window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason, window.location.pathname));
    return;
  }

  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    reportError(e, fatal ? 'fatal' : 'global');
    previous?.(e, fatal);
  });
}
