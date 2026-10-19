import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemeProvider, useLayout, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Txt } from '@/ui';

const poster = require('../../../assets/images/poster.jpg');
/**
 * The same picture on a much larger stretch of concrete (2160 by 2560), so it
 * can be scaled and moved freely without an edge ever showing. MARK is the
 * box around the container C inside it, measured from the pixels.
 */
const posterWide = require('../../../assets/images/poster-wide.jpg');
const WIDE = { w: 2160, h: 2560 };
const MARK = { x: 832, y: 945, w: 528, h: 690 };
const ALT = 'The letter C made of shipping containers on pale concrete, seen from above, with one yellow container in its opening';

/**
 * The sign in family of screens. The last frame of the opening film fills the
 * screen and the form sits on a sheet, so the film flows straight into it.
 * Phone: sheet at the bottom. Tablet portrait: a 560 wide sheet. Landscape:
 * the picture on the left, a card on the right. Always light, like paper.
 */
export function AuthFrame({ children, sheetBrand = true }: { children: ReactNode; sheetBrand?: boolean }) {
  return (
    <ThemeProvider force="light">
      <Frame sheetBrand={sheetBrand}>{children}</Frame>
    </ThemeProvider>
  );
}

function Frame({ children, sheetBrand }: { children: ReactNode; sheetBrand: boolean }) {
  const { c } = useTheme();
  const { width, height, tablet, wide } = useLayout();
  const insets = useSafeAreaInsets();
  const landscapeSplit = wide && width > height * 1.05;
  const [sheetH, setSheetH] = useState(0);
  // Phones: a tighter sheet leaves room for the whole C above it.
  const compact = !tablet;

  const brand = (
    <View
      style={{
        position: 'absolute',
        top: insets.top + (tablet ? 32 : 18),
        ...(tablet || landscapeSplit ? { left: 36, alignItems: 'flex-start' } : { right: 20, alignItems: 'flex-end' }),
        gap: 2,
      }}
    >
      <Txt style={{ fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.44 }}>cymis</Txt>
      {tablet ? (
        <Txt variant="caption" tone="ink2">
          Container audits
        </Txt>
      ) : null}
    </View>
  );

  if (landscapeSplit) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.paper }}>
        <View style={{ width: '58%', height: '100%', overflow: 'hidden' }}>
          <Image source={poster} accessibilityLabel={ALT} contentFit="cover" contentPosition={{ top: '46%', left: '50%' }} style={{ flex: 1 }} />
          {brand}
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }} keyboardShouldPersistTaps="handled">
            <Animated.View
              entering={FadeInDown.duration(320)}
              style={{ width: '100%', maxWidth: 440, padding: 36, gap: 20, borderRadius: radius.sheet, borderWidth: 1, borderColor: c.rule, backgroundColor: c.raised }}
            >
              {children}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Fit the whole container C into the space between the status bar (or the
  // wordmark on tablets) and the top of the sheet, whatever the screen. The
  // sheet is measured, so a notch, a home bar or bigger text cannot cover it.
  const sheetTop = height - (sheetH || height * 0.56);
  const top = insets.top + (tablet ? 96 : 20);
  // The foot of the C slides a little under the frosted sheet, so the picture
  // melts into the glass instead of stopping at a hard edge.
  const bottom = sheetTop + (tablet ? 26 : 18);
  const side = tablet ? 120 : 44;
  const scale = Math.max(0.2, Math.min((width - side * 2) / MARK.w, (bottom - top) / MARK.h, tablet ? 1.25 : 0.9));
  const imgW = WIDE.w * scale;
  const imgH = WIDE.h * scale;
  const imgLeft = width / 2 - (MARK.x + MARK.w / 2) * scale;
  const imgTop = (top + bottom) / 2 - (MARK.y + MARK.h / 2) * scale;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, overflow: 'hidden' }}>
      <Image
        source={posterWide}
        accessibilityLabel={ALT}
        contentFit="fill"
        transition={sheetH ? 0 : 200}
        style={{ position: 'absolute', left: imgLeft, top: imgTop, width: imgW, height: imgH }}
      />
      {tablet ? brand : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }}
          style={{ flexGrow: 0 }}
        >
          <Animated.View
            entering={FadeInDown.duration(360).springify().damping(20)}
            onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}
            style={{
              width: tablet ? 560 : '100%',
              maxWidth: '100%',
              gap: tablet ? 20 : compact ? 14 : 18,
              paddingTop: tablet ? 30 : compact ? 20 : 24,
              paddingHorizontal: tablet ? 40 : 24,
              paddingBottom: (tablet ? 34 : compact ? 16 : 26) + insets.bottom,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              overflow: 'hidden',
              boxShadow: '0px -14px 44px rgba(14,14,14,0.10)',
            }}
          >
            {/* Frosted glass: the concrete and the containers bleed softly through. */}
            <BlurView
              intensity={45}
              tint="light"
              blurMethod="dimezisBlurViewSdk31Plus"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                borderTopWidth: 1,
                borderColor: 'rgba(255,255,255,0.9)',
              }}
            />
            {!tablet && sheetBrand ? (
              // On phones the wordmark sits in the sheet so it never lands on a container.
              <Txt
                style={{ position: 'absolute', top: 26, right: 24, fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 }}
                accessibilityRole="header"
              >
                cymis
              </Txt>
            ) : null}
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
