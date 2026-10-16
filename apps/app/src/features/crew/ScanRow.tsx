import { Pressable, View } from 'react-native';
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

export function ScanRow({ scan, onPress, showStatus = true }: { scan: LocalScan; onPress?: () => void; showStatus?: boolean }) {
  const { c } = useTheme();
  const time = new Date(scan.item.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: c.rule }}>
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
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => ({ opacity: s.pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}
