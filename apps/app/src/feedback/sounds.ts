import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Short cues for the scan loop. The yard is loud and crews often have the
// phone at arm's length, so each outcome has its own sound shape, not just a
// different pitch. Files live in assets/sounds and can be swapped by name.
const sources = {
  found: require('../../assets/sounds/found.wav'),
  unexpected: require('../../assets/sounds/unexpected.wav'),
  error: require('../../assets/sounds/error.wav'),
  synced: require('../../assets/sounds/synced.wav'),
  shutter: require('../../assets/sounds/shutter.wav'),
} as const;

export type Cue = keyof typeof sources;

const players = new Map<Cue, AudioPlayer>();
let ready = false;

/** Load every cue once so the first scan plays without a delay. */
export async function preloadSounds(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    // Mix with music or calls instead of stopping them, and respect silent mode on iOS.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Some platforms do not support every option. Sounds still play.
  }
  for (const cue of Object.keys(sources) as Cue[]) {
    try {
      const player = createAudioPlayer(sources[cue]);
      player.volume = cue === 'synced' ? 0.6 : 1;
      players.set(cue, player);
    } catch {
      // A missing player only means that cue stays quiet.
    }
  }
}

export function playCue(cue: Cue): void {
  const player = players.get(cue);
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Never let a sound failure interrupt scanning.
  }
}
