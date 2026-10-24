import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';

// Checked once. Liquid Glass needs iOS 26 or newer and a build made with that
// SDK; everything else gets the frosted blur we had before.
const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** True when the phone draws Apple's Liquid Glass and the user has not turned transparency down. */
export function useLiquidGlass() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!liquid) return;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduced)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => sub.remove();
  }, []);
  return liquid && !reduced;
}

/**
 * Fills its parent with glass. Put it first inside a bar or capsule, with the
 * content after it. `veil` is how strongly the blur fallback is tinted, so
 * text stays readable over busy content.
 */
export function Frost({ veil = 0.74, intensity = 65 }: { veil?: number; intensity?: number }) {
  const { dark } = useTheme();
  const glass = useLiquidGlass();

  if (glass) {
    return <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? `rgba(30,30,29,${veil})` : `rgba(255,255,255,${veil})` }]} />
    </View>
  );
}
