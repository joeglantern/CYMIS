import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

const film = require('../../../assets/video/splash.mp4');
// The film rebuilt for landscape screens (made in Remotion): its three beats
// side by side, then the C grows into the sign in's picture column.
const filmWide = require('../../../assets/video/splash-wide.mp4');

const IS_WEB = Platform.OS === 'web';
const SEEN_KEY = 'cymis.film';

/**
 * On the web the page decides before it paints (public/index.html): the film
 * plays once per visit, and never with reduced motion.
 */
export function webFilmWanted() {
  return IS_WEB && typeof window !== 'undefined' && (window as { __cymisFilm?: boolean }).__cymisFilm === true;
}

/** Fades out the first frame the page shows while loading. */
function clearBootFrame(fade: boolean) {
  if (!IS_WEB || typeof document === 'undefined') return;
  const el = document.getElementById('boot');
  if (!el) return;
  if (!fade) {
    el.remove();
    return;
  }
  el.classList.add('gone');
  setTimeout(() => el.remove(), 320);
}

/**
 * The opening film: the camera drops into the yard and the containers settle
 * into the C. Plays once per cold start on phones and tablets, once per visit
 * on the web, and is left out when reduce motion is on.
 */
export function SplashFilm({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  // Picked once, so turning a tablet mid film does not restart it.
  // Same rule the sign in uses for its side by side layout, so the film lands on it.
  const [wide] = useState(() => IS_WEB && width > height * 1.05);
  const [skip, setSkip] = useState<boolean | null>(IS_WEB ? !webFilmWanted() : null);
  const player = useVideoPlayer(wide ? filmWide : film, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    if (IS_WEB) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => setSkip(reduce))
      .catch(() => setSkip(false));
  }, []);

  useEffect(() => {
    if (skip === true) {
      clearBootFrame(false);
      onDone();
    }
    if (skip === false) {
      player.play();
      if (IS_WEB) {
        try {
          sessionStorage.setItem(SEEN_KEY, '1');
        } catch {
          // Private windows can refuse; it just plays again next time.
        }
      }
    }
  }, [skip, player, onDone]);

  // The video now shows the same frame the page did, so the swap is invisible.
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) clearBootFrame(true);
  });
  useEventListener(player, 'playToEnd', onDone);
  // Never hold the app hostage if the video cannot play (a browser that
  // blocks autoplay, a codec it lacks, a slow first load).
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      clearBootFrame(true);
      onDone();
    }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      clearBootFrame(true);
      onDone();
    }, 7000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (skip !== false) return null;

  return (
    <Animated.View exiting={FadeOut.duration(260)} style={{ position: 'absolute', inset: 0, backgroundColor: wide ? '#ffffff' : '#39383a', zIndex: 50 }}>
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
    </Animated.View>
  );
}
