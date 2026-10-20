import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { LocalScan } from '@/offline/engine';
import { useTheme } from '@/theme/theme';
import { ContainerNumber, Icon, StatusChip, Txt, type BucketKey } from '@/ui';

/** Which bucket a scan on this phone belongs in. The server's answer wins once it is back. */
export function scanBucket(s: LocalScan): BucketKey {
  const server = s.server;
  if (server) {
    if (server.flags.length > 0 && server.reviewStatus !== 'APPROVED' && server.reviewStatus !== 'CORRECTED') return 'review';
    if (server.result === 'MATCHED') return 'found';
    if (server.result === 'DUPLICATE') return 'duplicate';
    return 'unexpected';
  }
  if (!s.checkOk) return 'review';
  return s.localResult === 'matched' ? 'found' : s.localResult === 'duplicate' ? 'duplicate' : 'unexpected';
}

export function ScanRow({ scan, onPress, showStatus = true, fresh }: { scan: LocalScan; onPress?: () => void; showStatus?: boolean; fresh?: boolean }) {
  const { c, dark } = useTheme();
  // A just saved scan arrives with a short yellow glow that fades out.
  const glow = useSharedValue(fresh ? 1 : 0);
  useEffect(() => {
    if (fresh) glow.value = withDelay(500, withTiming(0, { duration: 1400 }));
  }, [fresh, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const time = new Date(scan.item.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const content = (
    <Animated.View
      entering={fresh ? FadeInDown.duration(320) : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: c.rule }}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 2, bottom: 2, left: -8, right: -8, borderRadius: 8, backgroundColor: dark ? 'rgba(246,230,30,0.16)' : 'rgba(246,230,30,0.32)' }, glowStyle]}
      />
      <View style={{ flexShrink: 1, gap: 2 }}>
        <ContainerNumber value={scan.number} state={scan.checkOk ? 'valid' : 'invalid'} />
        {scan.status === 'rejected' && scan.reason ? (
          <Txt variant="caption" tone="dangerText" numberOfLines={2}>
            {scan.reason}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {showStatus && scan.status === 'queued' ? <Icon name="cloud-arrow-up" size={16} color={c.muted} /> : null}
        {scan.status === 'rejected' ? <StatusChip bucket="missing" size="sm" label="Not sent" /> : <StatusChip bucket={scanBucket(scan)} size="sm" />}
        <Txt variant="monoSm" tone="muted" style={{ width: 42, textAlign: 'right' }}>
          {time}
        </Txt>
      </View>
    </Animated.View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => ({ opacity: s.pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}
