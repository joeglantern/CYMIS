import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemeProvider, useLayout, useTheme } from '@/theme/theme';
import { floatShadow, fonts, radius } from '@/theme/tokens';
import { Txt } from '@/ui';

const poster = require('../../../assets/images/poster.jpg');
const POSTER_RATIO = 1280 / 720;
/** Where the middle of the container C sits in the poster, as a share of its height. */
const MARK_CENTRE = 0.65;
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

  // Keep the container C in full view: centre it in the space between the
  // status bar and the top of the sheet, using the sheet's measured height.
  const imgHeight = width * POSTER_RATIO;
  const sheetTop = height - (sheetH || height * 0.6);
  // The picture runs behind the status bar, so all of it above the sheet counts.
  const centreY = sheetTop / 2 + insets.top * 0.25 + (tablet ? 24 : 0);
  const imgTop = Math.min(0, Math.max(sheetTop + 24 - imgHeight, centreY - MARK_CENTRE * imgHeight));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, overflow: 'hidden' }}>
      <Image
        source={poster}
        accessibilityLabel={ALT}
        contentFit="cover"
        style={{ position: 'absolute', left: 0, top: imgTop, width, height: Math.max(imgHeight, height - imgTop) }}
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
              backgroundColor: c.raised,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              ...floatShadow(false),
            }}
          >
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
