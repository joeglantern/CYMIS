import { useEffect, useState } from 'react';
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
 * The scanner frame: four yellow corners that fill the free camera area, like
 * a QR scanner. They breathe while searching, pull in around the number when
 * it locks, and turn red with a shake when the check digit fails. Built to be
 * read at arm's length in bright sun. It fills its parent, so the parent says
 * how much room there is.
 */
export function GuideBox({ state, hint, number }: { state: GuideState; hint: string; number?: string | null }) {
  const { tablet } = useLayout();
  const corner = tablet ? 44 : 32;
  const stroke = tablet ? 5 : 4;
  // The frame's real size, and the locked number's, so the pull suits any screen.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [label, setLabel] = useState({ w: tablet ? 380 : 300, h: tablet ? 50 : 40 });
  // Locked, the corners close to a band just around the number.
  const pullX = Math.max(0, (box.w - Math.min(box.w, label.w + 48)) / 2);
  const pullY = Math.max(0, (box.h - Math.min(box.h, Math.max(tablet ? 110 : 80, label.h + 44))) / 2);

  const inset = useSharedValue(0);
  const breathe = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (state === 'locked') {
      inset.value = withSpring(1, { damping: 11, stiffness: 260 });
      breathe.value = withTiming(1, { duration: 120 });
    } else {
      inset.value = withTiming(0, { duration: 180 });
      // A small breath: on a big frame, scale moves the corners many pixels.
      breathe.value =
        state === 'searching' || state === 'reading'
          ? withRepeat(withSequence(withTiming(1.012, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true)
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
    <View style={{ flex: 1, alignItems: 'center', gap: 12, paddingVertical: 14 }} pointerEvents="none">
      <Animated.View
        accessibilityRole="image"
        accessibilityLabel={state === 'locked' && number ? `Locked on ${number}` : hint}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[{ flex: 1, width: '92%', minHeight: 0, alignItems: 'center', justifyContent: 'center' }, frame]}
      >
        {state === 'locked' ? <LockPulse x={pullX} y={pullY} /> : null}
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
          <Corner key={pos} pos={pos} inset={inset} size={corner} stroke={stroke} color={color} pullX={pullX} pullY={pullY} />
        ))}
        {state === 'locked' && number ? (
          <View onLayout={(e) => setLabel({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            <ContainerNumber value={number} size={tablet ? 'xl' : 'lg'} state="locked" color="#ffffff" />
          </View>
        ) : null}
      </Animated.View>
      <View style={{ maxWidth: '92%', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: brand.camera }}>
        <Txt color="#ffffff" align="center" style={{ fontFamily: fonts.medium, fontSize: tablet ? 17 : 15, lineHeight: 22 }} accessibilityLiveRegion="polite">
          {hint}
        </Txt>
      </View>
    </View>
  );
}

function Corner({
  pos,
  inset,
  size,
  stroke,
  color,
  pullX,
  pullY,
}: {
  pos: 'tl' | 'tr' | 'bl' | 'br';
  inset: SharedValue<number>;
  size: number;
  stroke: number;
  color: string;
  pullX: number;
  pullY: number;
}) {
  const style = useAnimatedStyle(() => {
    // The spring may overshoot. Clamped, so corners never cross into the number.
    const t = Math.min(inset.value, 1);
    const dy = t * pullY;
    const dx = t * pullX;
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
          borderTopWidth: top ? stroke : 0,
          borderBottomWidth: top ? 0 : stroke,
          borderLeftWidth: left ? stroke : 0,
          borderRightWidth: left ? 0 : stroke,
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

/** One soft ring that pushes out from the locked band around the number. */
function LockPulse({ x, y }: { x: number; y: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 650 });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ scaleX: 1 + t.value * 0.08 }, { scaleY: 1 + t.value * 0.22 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: y, left: x, right: x, bottom: y, borderRadius: 14, borderWidth: 3, borderColor: brand.yellow }, style]}
    />
  );
}
