// Browser version. Private windows can throw on storage access, so every call
// is guarded and the app keeps working without it.
export const kv = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage blocked. Settings fall back to defaults next time.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};
