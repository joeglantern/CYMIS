import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, type TextStyle, type StyleProp } from 'react-native';
import { Txt, type TxtProps } from './Text';

// Shared motion rules: short (150 to 600 ms), eased out, never in the way.
// Everything here stands still when the phone asks for reduced motion.

let reduce = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduce = v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
  reduce = v;
});

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A number that runs up (or down) to its new value instead of jumping. */
export function useCountUp(value: number, duration = 650): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (reduce || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const v = Math.round(start + (value - start) * easeOut(t));
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, duration]);

  return shown;
}

/** Text for a counting number, formatted with thousands separators. */
export function AnimatedNumber({ value, style, ...rest }: { value: number; style?: StyleProp<TextStyle> } & Omit<TxtProps, 'children'>) {
  const shown = useCountUp(value);
  return (
    <Txt {...rest} style={[{ fontVariant: ['tabular-nums'] }, style]} accessibilityLabel={value.toLocaleString('en-GB')}>
      {shown.toLocaleString('en-GB')}
    </Txt>
  );
}
