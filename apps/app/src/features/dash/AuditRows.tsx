import type { AuditDto, ScanDto } from '@cymis/schemas';
import { formatContainerNumber } from '@cymis/iso6346';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { BucketBar, LiveBadge, Pill, StatusChip, Txt, fmt, type BucketKey } from '@/ui';
import { barProps, statusWords, time } from './format';

/** Status pill used in audit lists. */
export function AuditStatus({ status }: { status: AuditDto['status'] }) {
  if (status === 'ACTIVE') return <LiveBadge />;
  return <Pill label={statusWords[status]} filled={status !== 'DRAFT'} />;
}

export function openAudit(a: AuditDto) {
  router.push((a.status === 'DRAFT' ? `/dashboard/audits/${a.id}/setup` : `/dashboard/audits/${a.id}`) as never);
}

/** One row in the Active audits list on the overview. */
export function AuditRow({ audit, last }: { audit: AuditDto; last?: boolean }) {
  const { c } = useTheme();
  const k = audit.counts;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${audit.name}, ${k.found} of ${k.expected} found`}
      onPress={() => openAudit(audit)}
      style={(s) => ({
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 20,
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.rule,
        backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
        borderRadius: (s as { hovered?: boolean }).hovered ? radius.sm : 0,
      })}
    >
      <View style={{ flexGrow: 1.4, flexBasis: 180, minWidth: 0, gap: 2 }}>
        <Txt variant="bodyStrong" style={{ fontSize: 15 }} numberOfLines={1}>
          {audit.name}
        </Txt>
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {audit.section.name}
        </Txt>
      </View>
      <View style={{ flexGrow: 1.6, flexBasis: 200, minWidth: 0, gap: 8 }}>
        <BucketBar {...barProps(k, audit.status === 'ACTIVE')} legend={false} />
        <Txt variant="caption" tone="muted">
          <Txt variant="caption" style={{ fontFamily: fonts.mono }}>
            {fmt(k.found)}
          </Txt>
          {` of ${fmt(k.expected)} found`}
        </Txt>
      </View>
      <AuditStatus status={audit.status} />
    </Pressable>
  );
}

/** Which bucket a scan belongs in, for chips. */
export function scanBucket(s: ScanDto): BucketKey {
  if (s.result === 'DUPLICATE') return 'duplicate';
  if (s.flags.length > 0 && s.reviewStatus !== 'APPROVED' && s.reviewStatus !== 'CORRECTED') return 'review';
  if (s.result === 'UNEXPECTED') return 'unexpected';
  return 'found';
}

/** Line in the Latest feed. */
export function FeedLine({ scan, auditName, last }: { scan: ScanDto; auditName: string; last?: boolean }) {
  const { c } = useTheme();
  const b = scanBucket(scan);
  const what =
    b === 'found' ? 'found' : b === 'unexpected' ? 'found a box not on the list,' : b === 'duplicate' ? 'scanned again' : 'scanned, needs a look:';
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.rule }}>
      <Txt style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 20, width: 40 }} tone="muted">
        {time(scan.capturedAt)}
      </Txt>
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="bodySm" tone="ink2">
          {`${scan.auditor.fullName.split(' ')[0]} ${what} `}
          <Txt variant="bodySm" style={{ fontFamily: fonts.monoMedium }}>
            {scan.containerNumber.length === 11 ? formatContainerNumber(scan.containerNumber) : scan.containerNumber}
          </Txt>
          {` in ${auditName}`}
        </Txt>
        {b !== 'found' ? <StatusChip bucket={b} size="sm" /> : null}
      </View>
    </View>
  );
}
