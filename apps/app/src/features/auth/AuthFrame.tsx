import { useEventListener } from 'expo';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useBoot } from '@/state/boot';
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
/** Ten seconds of slow moving sunlight over the same photo, played forwards then back so it never jumps. */
const lightLoop = require('../../../assets/video/signin-loop.mp4');
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
          <Drift style={{ flex: 1 }}>
            <Image source={poster} accessibilityLabel={ALT} contentFit="cover" contentPosition={{ top: '50%', left: '50%' }} style={{ flex: 1 }} />
            <LivingLight cover style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </Drift>
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
      <Drift originX={width / 2 - imgLeft} originY={(top + bottom) / 2 - imgTop} style={{ position: 'absolute', left: imgLeft, top: imgTop, width: imgW, height: imgH }}>
        <Image source={posterWide} accessibilityLabel={ALT} contentFit="fill" transition={sheetH ? 0 : 200} style={{ width: '100%', height: '100%' }} />
        {/* The moving light sits exactly over the original photo inside the wider still. */}
        <LivingLight style={{ position: 'absolute', left: '33.333%', top: '25%', width: '33.333%', height: '50%' }} />
      </Drift>
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

/**
 * The photo breathes: a slow push in of a few percent and back, centred on
 * the container C, about twenty seconds each way. Still when the phone asks
 * for reduced motion.
 */
function Drift({ children, style, originX, originY }: { children: ReactNode; style: object; originX?: number; originY?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 0.035 }, { translateY: -t.value * 6 }],
  }));
  const origin = originX !== undefined && originY !== undefined ? { transformOrigin: `${originX}px ${originY}px` } : null;
  return <Animated.View style={[style, origin, anim]}>{children}</Animated.View>;
}

/**
 * The sun moving slowly over the yard: shadows swing across the concrete and
 * back. Fades in only once it is really playing, so the still photo shows
 * first and there is never a black frame. Left out for reduced motion.
 */
function LivingLight({ style, cover }: { style: object; cover?: boolean }) {
  const reduce = useReducedMotion();
  const shown = useSharedValue(0);
  // Starts once the opening film is over, so two videos never play at once.
  const filmDone = useBoot((s) => s.filmDone);
  const player = useVideoPlayer(reduce ? null : lightLoop, (p) => {
    p.muted = true;
    p.loop = true;
  });
  useEffect(() => {
    if (filmDone && !reduce) player.play();
  }, [filmDone, reduce, player]);
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) shown.value = withTiming(1, { duration: 900 });
  });
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[style, fade]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit={cover ? 'cover' : 'fill'} nativeControls={false} allowsPictureInPicture={false} />
    </Animated.View>
  );
}
