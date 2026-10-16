// Small key value store for settings and cached profile data. Not for
// secrets: tokens go in SecureStore (see auth/secure.ts).
import Storage from 'expo-sqlite/kv-store';

export const kv = {
  get(key: string): string | null {
    return Storage.getItemSync(key);
  },
  set(key: string, value: string): void {
    Storage.setItemSync(key, value);
  },
  remove(key: string): void {
    Storage.removeItemSync(key);
  },
};
