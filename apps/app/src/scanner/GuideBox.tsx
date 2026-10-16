import { useEffect } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLayout } from '@/theme/theme';
import { brand, fonts, radius } from '@/theme/tokens';
import { ContainerNumber, Txt } from '@/ui';

export type GuideState = 'searching' | 'reading' | 'locked' | 'failed';

/**
 * The scanner frame: four yellow corners. They breathe while searching, pull
 * in with a spring when a number locks, and turn red with a shake when the
 * check digit fails. Built to be read at arm's length in bright sun.
 */
export function GuideBox({ state, hint, number }: { state: GuideState; hint: string; number?: string | null }) {
  const { tablet } = useLayout();
  const w = tablet ? 460 : 320;
  const h = tablet ? 190 : 124;
  const corner = tablet ? 36 : 28;

  const inset = useSharedValue(0);
  const breathe = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (state === 'locked') {
      inset.value = withSpring(1, { damping: 11, stiffness: 260 });
      breathe.value = withTiming(1, { duration: 120 });
    } else {
      inset.value = withTiming(0, { duration: 180 });
      breathe.value =
        state === 'searching' || state === 'reading'
          ? withRepeat(withSequence(withTiming(1.025, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true)
          : withTiming(1, { duration: 120 });
    }
    if (state === 'failed') {
      shake.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 90 }),
        withTiming(-6, { duration: 90 }),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [state, inset, breathe, shake]);

  const frame = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: breathe.value }] }));
  const color = state === 'failed' ? brand.red : brand.yellow;

  return (
    <View style={{ alignItems: 'center', gap: 16 }} pointerEvents="none">
      <Animated.View
        accessibilityRole="image"
        accessibilityLabel={state === 'locked' && number ? `Locked on ${number}` : hint}
        style={[{ width: w, maxWidth: '88%', height: h, alignItems: 'center', justifyContent: 'center' }, frame]}
      >
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
          <Corner key={pos} pos={pos} inset={inset} size={corner} color={color} pull={tablet ? 40 : 26} />
        ))}
        {state === 'locked' && number ? <ContainerNumber value={number} size={tablet ? 'xl' : 'lg'} state="locked" color="#ffffff" /> : null}
      </Animated.View>
      <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: brand.camera }}>
        <Txt color="#ffffff" style={{ fontFamily: fonts.medium, fontSize: tablet ? 17 : 15, lineHeight: 22 }} accessibilityLiveRegion="polite">
          {hint}
        </Txt>
      </View>
    </View>
  );
}

function Corner({ pos, inset, size, color, pull }: { pos: 'tl' | 'tr' | 'bl' | 'br'; inset: SharedValue<number>; size: number; color: string; pull: number }) {
  const style = useAnimatedStyle(() => {
    const dy = inset.value * pull;
    const dx = inset.value * 6;
    return pos[0] === 't'
      ? pos[1] === 'l'
        ? { top: dy, left: dx }
        : { top: dy, right: dx }
      : pos[1] === 'l'
        ? { bottom: dy, left: dx }
        : { bottom: dy, right: dx };
  });
  const top = pos[0] === 't';
  const left = pos[1] === 'l';
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderColor: color,
          borderTopWidth: top ? 4 : 0,
          borderBottomWidth: top ? 0 : 4,
          borderLeftWidth: left ? 4 : 0,
          borderRightWidth: left ? 0 : 4,
          borderTopLeftRadius: top && left ? 8 : 0,
          borderTopRightRadius: top && !left ? 8 : 0,
          borderBottomLeftRadius: !top && left ? 8 : 0,
          borderBottomRightRadius: !top && !left ? 8 : 0,
        },
        style,
      ]}
    />
  );
}
