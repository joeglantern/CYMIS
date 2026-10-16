import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kv } from '@/lib/kv';

export type ThemePreference = 'system' | 'light' | 'graphite';

interface SettingsState {
  theme: ThemePreference;
  sound: boolean;
  haptics: boolean;
  /** Keep the screen awake while the scanner is open. */
  keepAwake: boolean;
  /** Shown once, the first time someone opens the scanner. */
  seenScannerTips: boolean;
  /** Which screens an admin or supervisor is looking at. Null means the default for this device. */
  viewAs: 'ADMIN' | 'SUPERVISOR' | 'AUDITOR' | null;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      sound: true,
      haptics: true,
      keepAwake: true,
      seenScannerTips: false,
      viewAs: null,
      set: (patch) => set(patch),
    }),
    {
      name: 'cymis.settings',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => kv.get(k),
        setItem: (k, v) => kv.set(k, v),
        removeItem: (k) => kv.remove(k),
      })),
    },
  ),
);
