import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Start up state shared across screens. Screens under the opening film wait
 * for it to finish before doing anything that pops up (Face ID, the keyboard).
 */
export const useBoot = create<{ filmDone: boolean }>(() => ({ filmDone: Platform.OS === 'web' }));
