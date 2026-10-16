import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(run: () => Promise<void>) {
  if (!supported) return;
  run().catch(() => undefined);
}

export const haptic = {
  /** Picking a chip, toggling a switch. */
  select: () => safe(() => Haptics.selectionAsync()),
  /** A button that commits something small. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** The guide box locking onto a number. Firm, so it is felt through gloves. */
  lock: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
