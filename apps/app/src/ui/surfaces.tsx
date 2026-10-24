import { useEffect, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { floatShadow, fonts, radius, softShadow } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export function Card({
  children,
  onPress,
  onPressIn,
  float,
  style,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** Runs as soon as a finger lands, before the tap ends. Good for preloading. */
  onPressIn?: () => void;
  float?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const { c, dark } = useTheme();
  const base: ViewStyle = {
    gap: 12,
    padding: 18,
    backgroundColor: c.raised,
    borderRadius: radius.md,
    ...(float ? floatShadow(dark) : softShadow(dark)),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onPressIn}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={(state) => [
        base,
        (state as { hovered?: boolean }).hovered && floatShadow(dark),
        { transform: [{ scale: state.pressed ? 0.99 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** A section heading with an optional note on the right. Used across the dashboard and settings. */
export function SectionTitle({ title, aside, small }: { title: string; aside?: ReactNode; small?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        paddingBottom: small ? 6 : 12,
      }}
    >
      <Txt variant={small ? 'label' : 'heading'} tone={small ? 'muted' : 'ink'} caps={small} accessibilityRole="header">
        {title}
      </Txt>
      {typeof aside === 'string' ? (
        <Txt variant="caption" tone="muted" style={{ flexShrink: 1, textAlign: 'right' }}>
          {aside}
        </Txt>
      ) : (
        aside
      )}
    </View>
  );
}

/** Small caps label above a group, like TODAY or EARLIER. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Txt variant="label" tone="muted" caps accessibilityRole="header">
      {children}
    </Txt>
  );
}

export type BannerTone = 'offline' | 'warning' | 'info' | 'closed';

/** Full width strip under the header. Offline is black so it is seen in sun. */
export function Banner({
  tone,
  children,
  action,
}: {
  tone: BannerTone;
  children: string;
  action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  const offline = tone === 'offline';
  const icon: IconName = offline ? 'wifi-slash' : tone === 'warning' ? 'warning-circle' : tone === 'closed' ? 'lock-key' : 'info';
  const fg = offline ? c.onInk : c.ink;
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: offline ? c.ink : c.paper2,
        borderBottomWidth: 1,
        borderBottomColor: offline ? c.ink : c.rule,
      }}
    >
      <Icon name={icon} size={18} color={offline ? c.onInk : tone === 'warning' ? c.missing : c.muted} />
      <Txt variant="bodySm" color={fg} style={{ flex: 1 }}>
        {children}
      </Txt>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Txt
            variant="bodySmStrong"
            color={offline ? c.onInk : c.accent}
            style={offline ? { textDecorationLine: 'underline' } : undefined}
          >
            {action.label}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  image,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
  /** A picture from assets/images/empty. Shown instead of the icon. */
  image?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 12, maxWidth: 360, alignSelf: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
      {image ? (
        <Animated.View entering={FadeIn.duration(420)}>
          <Image source={image} contentFit="contain" style={{ width: 168, height: 168, marginBottom: 4 }} accessibilityIgnoresInvertColors />
        </Animated.View>
      ) : (
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.paper2,
        }}
      >
        <Icon name={icon} size={28} />
      </View>
      )}
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      <Txt variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
        {body}
      </Txt>
      {action}
    </View>
  );
}

/** Grey block that breathes while data loads. Same size as what it stands in for. */
export function Skeleton({ height = 16, width = '100%', radius: r = 6 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const { c } = useTheme();
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: r, backgroundColor: c.paper2 }, style]} />;
}

export interface PillOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Single choice row of pills, for filters. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              feedback.select();
              onChange(o.id);
            }}
            style={(state) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 34,
              paddingHorizontal: 12,
              borderRadius: radius.full,
              backgroundColor: on ? c.ink : (state as { hovered?: boolean }).hovered ? c.hover : c.paper2,
            })}
          >
            <Txt color={on ? c.onInk : c.ink} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 16 }}>
              {o.label}
            </Txt>
            {o.count !== undefined ? (
              <Txt color={on ? c.onInk : c.ink} style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, opacity: 0.75 }}>
                {o.count}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A plain on and off row for settings. */
export function ToggleRow({
  icon,
  title,
  detail,
  value,
  onChange,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      onPress={() => {
        feedback.select();
        onChange(!value);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10 }}
    >
      <Icon name={icon} size={22} color={c.ink2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {detail ? (
          <Txt variant="caption" tone="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          padding: 3,
          backgroundColor: value ? c.ink : c.ruleStrong,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? c.onInk : '#ffffff' }} />
      </View>
    </Pressable>
  );
}

/** Row in a list that opens something. */
export function NavRow({
  icon,
  title,
  detail,
  onPress,
  trailing,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 60,
        paddingVertical: 10,
        opacity: state.pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={22} color={c.ink2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {detail ? (
          <Txt variant="caption" tone="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
      {trailing}
      <Icon name="caret-right" size={18} color={c.muted} />
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.rule }} />;
}
