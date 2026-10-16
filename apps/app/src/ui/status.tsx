import { formatContainerNumber, isValidContainerNumber } from '@cymis/iso6346';
import { View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { brand, fonts, radius, type Palette } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/** found, missing, unexpected, review (mismatched) and duplicate. */
export type BucketKey = 'found' | 'missing' | 'unexpected' | 'review' | 'duplicate';

export const bucketWords: Record<BucketKey, string> = {
  found: 'Found',
  missing: 'Missing',
  unexpected: 'Unexpected',
  review: 'Needs review',
  duplicate: 'Scanned twice',
};

const glyphs: Record<BucketKey, IconName> = {
  found: 'check-circle',
  missing: 'minus-circle',
  unexpected: 'question',
  review: 'warning-circle',
  duplicate: 'copy',
};

export function bucketColours(c: Palette, b: BucketKey) {
  switch (b) {
    case 'found':
      return { bg: c.found, fg: c.onStatus };
    case 'missing':
      return { bg: c.missing, fg: c.onStatus };
    case 'unexpected':
      return { bg: c.unexpected, fg: c.onUnexpected };
    case 'review':
      return { bg: c.review, fg: c.onStatus };
    case 'duplicate':
      return { bg: c.paper2, fg: c.ink2 };
  }
}

/** Always an icon and a word. Colour is never the only signal. */
export function StatusChip({ bucket, label, size = 'md' }: { bucket: BucketKey; label?: string; size?: 'sm' | 'md' }) {
  const { c } = useTheme();
  const { bg, fg } = bucketColours(c, bucket);
  const sm = size === 'sm';
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: sm ? 4 : 6,
        height: sm ? 22 : 26,
        paddingLeft: sm ? 6 : 8,
        paddingRight: sm ? 8 : 10,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: bucket === 'duplicate' ? 1 : 0,
        borderColor: c.rule,
      }}
    >
      <Icon name={glyphs[bucket]} size={sm ? 13 : 15} color={fg} weight="bold" />
      <Txt color={fg} numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: sm ? 12 : 13, lineHeight: 16 }}>
        {label ?? bucketWords[bucket]}
      </Txt>
    </View>
  );
}

/**
 * Container number in mono, split as owner / serial / check digit. The check
 * digit sits in a box: yellow when the number is locked, red when it fails.
 */
export function ContainerNumber({
  value,
  size = 'md',
  state,
  color,
}: {
  value: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** locked: read and verified. invalid: check digit fails. Defaults from the number itself. */
  state?: 'locked' | 'valid' | 'invalid';
  color?: string;
}) {
  const { c, dark } = useTheme();
  const valid = isValidContainerNumber(value);
  const s = state ?? (valid ? 'valid' : 'invalid');
  const formatted = value.length === 11 ? formatContainerNumber(value) : value;
  const [owner = '', serial = '', check = ''] = formatted.split(' ');
  const fontSize = size === 'xl' ? 34 : size === 'lg' ? 28 : size === 'sm' ? 14 : 16;
  const ink = color ?? c.ink;
  const box =
    s === 'locked'
      ? { bg: brand.yellow, fg: '#0e0e0e', border: brand.yellow }
      : s === 'invalid'
        ? dark
          ? { bg: c.missing, fg: '#ffffff', border: c.missing }
          : { bg: 'transparent', fg: c.missing, border: c.missing }
        : { bg: 'transparent', fg: ink, border: ink };
  const text = {
    fontFamily: fonts.monoMedium,
    fontSize,
    lineHeight: Math.round(fontSize * 1.25),
    letterSpacing: fontSize * 0.02,
    color: ink,
  };

  return (
    <View
      accessibilityLabel={`Container ${value.split('').join(' ')}${s === 'invalid' ? ', check digit fails' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: fontSize * 0.45 }}
    >
      <Txt style={text}>{owner}</Txt>
      {serial ? <Txt style={text}>{serial}</Txt> : null}
      {check ? (
        <View
          style={{
            minWidth: Math.round(fontSize * 1.35),
            height: Math.round(fontSize * 1.35),
            paddingHorizontal: fontSize * 0.12,
            borderWidth: 1.5,
            borderRadius: fontSize > 20 ? 6 : 4,
            borderColor: box.border,
            backgroundColor: box.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={[text, { color: box.fg, lineHeight: Math.round(fontSize * 1.1) }]}>{check}</Txt>
        </View>
      ) : null}
    </View>
  );
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

/** Always visible on crew screens: is my work safe? */
export function SyncChip({
  state,
  queued = 0,
  lastSynced,
  onCamera,
}: {
  state: SyncState;
  queued?: number;
  lastSynced?: string;
  /** Use on the black scanner screen. */
  onCamera?: boolean;
}) {
  const { c } = useTheme();
  const text =
    state === 'synced'
      ? lastSynced
        ? `Synced ${lastSynced}`
        : 'All sent'
      : state === 'syncing'
        ? `Sending ${queued}`
        : state === 'offline'
          ? queued > 0
            ? `Offline, ${queued} waiting`
            : 'Offline'
          : queued > 0
            ? `${queued} not sent`
            : 'Not sent';
  const icon: IconName =
    state === 'synced'
      ? 'cloud-check'
      : state === 'syncing'
        ? 'arrows-clockwise'
        : state === 'offline'
          ? 'wifi-slash'
          : 'warning-circle';
  const look =
    state === 'offline'
      ? onCamera
        ? { bg: '#ffffff', fg: '#0e0e0e', border: '#ffffff', ic: '#0e0e0e' }
        : { bg: c.ink, fg: c.onInk, border: c.ink, ic: c.onInk }
      : state === 'error'
        ? { bg: onCamera ? brand.cameraRaised : c.paper2, fg: onCamera ? '#ffffff' : c.dangerText, border: c.missing, ic: c.missing }
        : onCamera
          ? { bg: brand.cameraRaised, fg: '#ffffff', border: brand.cameraRaised, ic: state === 'synced' ? '#7fd1a5' : '#ffffff' }
          : { bg: c.paper2, fg: c.ink, border: c.rule, ic: state === 'synced' ? c.found : c.ink };
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 30,
        paddingLeft: 10,
        paddingRight: 12,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: look.border,
        backgroundColor: look.bg,
      }}
    >
      <Icon name={icon} size={16} color={look.ic} weight={state === 'synced' ? 'fill' : 'regular'} />
      <Txt color={look.fg} numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 16 }}>
        {text}
      </Txt>
    </View>
  );
}

/** Black pill with a yellow dot. Marks an audit that is running. */
export function LiveBadge({ label = 'Live' }: { label?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        height: 24,
        paddingHorizontal: 10,
        borderRadius: radius.full,
        backgroundColor: brand.camera,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: brand.yellow }} />
      <Txt color="#ffffff" style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Quiet pill for states like Not started or Closed. */
export function Pill({ label, filled }: { label: string; filled?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        justifyContent: 'center',
        height: 24,
        paddingHorizontal: 10,
        borderRadius: radius.full,
        borderWidth: filled ? 0 : 1,
        borderColor: c.ruleStrong,
        backgroundColor: filled ? c.paper2 : 'transparent',
      }}
    >
      <Txt tone="ink2" style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Two letter avatar. Colour comes from the name so a person keeps theirs everywhere. */
export function Avatar({ name, size = 32, ring }: { name: string; size?: number; ring?: string }) {
  const { c } = useTheme();
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const looks = [
    { bg: c.ink, fg: c.onInk },
    { bg: brand.royal, fg: '#ffffff' },
    { bg: brand.gold, fg: '#0e0e0e' },
    { bg: brand.skyDeep, fg: '#ffffff' },
    { bg: brand.found, fg: '#ffffff' },
  ];
  const look = looks[hash % looks.length]!;
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: look.bg,
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      <Txt color={look.fg} style={{ fontFamily: fonts.semibold, fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.5) }}>
        {initials}
      </Txt>
    </View>
  );
}
