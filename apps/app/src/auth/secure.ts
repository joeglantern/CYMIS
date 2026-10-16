import * as SecureStore from 'expo-secure-store';

// The refresh token lives in the phone's keychain (iOS) or keystore (Android),
// never in plain storage. Only readable while the device is unlocked.
const KEY = 'cymis.refresh';
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureToken = {
  async get(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY, opts);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY, token, opts);
  },
  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY, opts);
    } catch {
      // Already gone.
    }
  },
};
