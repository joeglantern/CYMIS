import { create } from 'zustand';

export interface PreviousSignIn {
  at: string;
  device: string | null;
  failedAttempts: number;
}

/** Set on sign in, shown once as a notice, then cleared. */
export const useLastVisit = create<{ previous: PreviousSignIn | null }>(() => ({ previous: null }));
