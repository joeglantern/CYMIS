import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedNumber } from './motion';
import { useTheme } from '@/theme/theme';
import { fonts, radius, type } from '@/theme/tokens';
import { bucketColours, type BucketKey } from './status';
import { Txt } from './Text';

export interface BucketCounts {
  found: number;
  review: number;
  unexpected: number;
  missing: number;
}

const order: { key: keyof BucketCounts; label: string }[] = [
  { key: 'found', label: 'Found' },
  { key: 'review', label: 'Needs review' },
  { key: 'unexpected', label: 'Unexpected' },
  { key: 'missing', label: 'Missing' },
];

export const fmt = (n: number) => n.toLocaleString('en-GB');

/**
 * One segmented bar for the four buckets, with an optional legend. While an
 * audit is running, boxes nobody has reached yet are not missing: pass them
 * as `left` and they show as a quiet grey stretch instead of red.
 */
export function BucketBar({
  counts,
  left = 0,
  legend = true,
  height = 10,
}: {
  counts: BucketCounts;
  left?: number;
  legend?: boolean;
  height?: number;
}) {
  const { c } = useTheme();
  const total = order.reduce((s, o) => s + counts[o.key], 0) + left;
  const shown = order.filter((o) => o.key !== 'missing' || counts.missing > 0 || left === 0);
  const summary = [...shown.map((o) => `${counts[o.key]} ${o.label.toLowerCase()}`), ...(left ? [`${left} not scanned yet`] : [])].join(', ');
  return (
    <View style={{ gap: 12, minWidth: 0 }} accessibilityRole="progressbar" accessibilityLabel={summary}>
      <View style={{ flexDirection: 'row', gap: 2, height, borderRadius: radius.full, overflow: 'hidden', backgroundColor: c.paper2 }}>
        {total > 0
          ? order
              .filter((o) => counts[o.key] > 0)
              .map((o) => (
                <Segment key={o.key} value={counts[o.key]} color={bucketColours(c, o.key as BucketKey).bg} />
              ))
          : null}
        {left > 0 ? <Segment value={left} color={c.paper2} /> : null}
      </View>
      {legend ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8 }}>
          {left > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.ruleStrong }} />
              <Txt variant="caption" tone="muted">
                <Txt variant="caption" style={{ fontFamily: fonts.monoMedium }}>
                  {fmt(left)}
                </Txt>{' '}
                Not scanned yet
              </Txt>
            </View>
          ) : null}
          {shown.map((o) => (
            <View key={o.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: bucketColours(c, o.key as BucketKey).bg,
                  borderWidth: o.key === 'unexpected' ? 1 : 0,
                  borderColor: c.ink,
                }}
              />
              <Txt variant="caption" tone="muted">
                <Txt variant="caption" style={{ fontFamily: fonts.monoMedium }}>
                  {fmt(counts[o.key])}
                </Txt>{' '}
                {o.label}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A bar segment that grows into place and eases to new sizes as scans come in. */
function Segment({ value, color }: { value: number; color: string }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, grow]);
  const style = useAnimatedStyle(() => ({ flexGrow: grow.value }));
  return <Animated.View style={[{ flexBasis: 0, minWidth: 4, backgroundColor: color }, style]} />;
}

/** One big number with a label. */
export function StatTile({
  label,
  value,
  detail,
  bucket,
  compact,
}: {
  label: string;
  value: number | string;
  detail?: string;
  bucket?: Exclude<BucketKey, 'duplicate'>;
  compact?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: compact ? 140 : 160,
        minWidth: 0,
        gap: 8,
        paddingVertical: compact ? 16 : 20,
        paddingHorizontal: compact ? 16 : 24,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.rule,
        borderRadius: radius.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {bucket ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: bucketColours(c, bucket).bg,
              borderWidth: bucket === 'unexpected' ? 1 : 0,
              borderColor: c.ink,
            }}
          />
        ) : null}
        <Txt variant="label" tone="muted" caps numberOfLines={1}>
          {label}
        </Txt>
      </View>
      {typeof value === 'number' ? (
        <AnimatedNumber value={value} style={[type.stat, compact && { fontSize: 36, lineHeight: 40 }]} numberOfLines={1} adjustsFontSizeToFit />
      ) : (
        <Txt style={[type.stat, compact && { fontSize: 36, lineHeight: 40 }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Txt>
      )}
      {detail ? (
        <Txt variant="caption" tone="muted" numberOfLines={2}>
          {detail}
        </Txt>
      ) : null}
    </View>
  );
}
