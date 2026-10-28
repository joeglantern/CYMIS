import { Platform } from 'react-native';
import { create } from 'zustand';
import { webFilmWanted } from '@/features/shell/SplashFilm';

/**
 * Start up state shared across screens. Screens under the opening film wait
 * for it to finish before doing anything that pops up (Face ID, the keyboard).
 */
// On the web the film only plays when the page asked for it (once per visit).
export const useBoot = create<{ filmDone: boolean }>(() => ({ filmDone: Platform.OS === 'web' ? !webFilmWanted() : false }));
