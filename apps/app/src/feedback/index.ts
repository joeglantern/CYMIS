import { useSettings } from '@/state/settings';
import { haptic } from './haptics';
import { playCue } from './sounds';

export { preloadSounds } from './sounds';
export { haptic } from './haptics';

function allowed() {
  const { sound, haptics } = useSettings.getState();
  return { sound, haptics };
}

/**
 * One place that decides how each moment feels and sounds, so the scan loop
 * stays consistent everywhere. Settings can turn sound or vibration off.
 */
export const feedback = {
  /** Number read and on the list. */
  found() {
    const a = allowed();
    if (a.haptics) haptic.success();
    if (a.sound) playCue('found');
  },
  /** Number read but not on the list. Worth a look, not an error. */
  unexpected() {
    const a = allowed();
    if (a.haptics) haptic.warning();
    if (a.sound) playCue('unexpected');
  },
  /** Already scanned in this audit. */
  duplicate() {
    const a = allowed();
    if (a.haptics) haptic.warning();
    if (a.sound) playCue('unexpected');
  },
  /** Check digit fails, or the server refused a scan. */
  error() {
    const a = allowed();
    if (a.haptics) haptic.error();
    if (a.sound) playCue('error');
  },
  /** The guide box locked onto a number. */
  lock() {
    if (allowed().haptics) haptic.lock();
  },
  shutter() {
    const a = allowed();
    if (a.haptics) haptic.tap();
    if (a.sound) playCue('shutter');
  },
  /** The offline queue went out. Quiet on purpose. */
  synced() {
    const a = allowed();
    if (a.haptics) haptic.tap();
    if (a.sound) playCue('synced');
  },
  select() {
    if (allowed().haptics) haptic.select();
  },
  tap() {
    if (allowed().haptics) haptic.tap();
  },
  /** Something went through, like signing in or closing an audit. Felt, not heard. */
  success() {
    if (allowed().haptics) haptic.success();
  },
};
