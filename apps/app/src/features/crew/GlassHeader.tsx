import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Frost, Txt } from '@/ui';

/** Height of the glass bar, below the status bar. */
export const BAR = 50;

/** Tracks how far the page has scrolled, for the glass bar. */
export function useHeaderScroll() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.value = e.contentOffset.y;
    },
  });
  return { y, onScroll };
}

/** Room to leave under the content so the floating tab bar never covers it. */
export function useTabSpace() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 92;
}

/**
 * A thin bar fixed at the top. Clear while the big title is on screen, then
 * it frosts over and shows a small title once the big one scrolls away.
 */
export function GlassBar({ y, title, left, right }: { y: SharedValue<number>; title: string; left?: ReactNode; right?: ReactNode }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const glass = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [6, 36], [0, 1], Extrapolation.CLAMP) }));
  const small = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [44, 72], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [44, 72], [6, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: insets.top + BAR }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, glass]}>
        <Frost veil={0.72} intensity={60} />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderBottomWidth: 1,
            borderBottomColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(14,14,14,0.07)',
          }}
        />
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: BAR, marginTop: insets.top, paddingHorizontal: 12 }}>
        <View style={{ width: 110, alignItems: 'flex-start' }}>{left}</View>
        <Animated.View pointerEvents="none" style={[{ flex: 1, alignItems: 'center' }, small]}>
          <Txt numberOfLines={1} color={c.ink} style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 }}>
            {title}
          </Txt>
        </Animated.View>
        <View style={{ width: 110, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

/** The big title at the top of the scrolling content, under the glass bar. */
export function LargeTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { gutter, tablet } = useLayout();
  return (
    <View style={{ paddingTop: insets.top + BAR + (tablet ? 14 : 4), paddingHorizontal: gutter, paddingBottom: tablet ? 18 : 14, gap: 4 }}>
      {eyebrow ? (
        <Txt variant="bodySm" tone="muted" numberOfLines={1}>
          {eyebrow}
        </Txt>
      ) : null}
      <Txt accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: tablet ? 36 : 32, lineHeight: tablet ? 42 : 38, letterSpacing: tablet ? -0.9 : -0.8 }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}
