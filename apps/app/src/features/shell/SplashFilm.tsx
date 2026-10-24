import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

const film = require('../../../assets/video/splash.mp4');

/**
 * The opening film: the camera drops into the yard and the containers settle
 * into the C. Plays once per cold start on phones and tablets, and is left out
 * when reduce motion is on.
 */
export function SplashFilm({ onDone }: { onDone: () => void }) {
  const [skip, setSkip] = useState<boolean | null>(null);
  const player = useVideoPlayer(film, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => setSkip(reduce))
      .catch(() => setSkip(false));
  }, []);

  useEffect(() => {
    if (skip === true) onDone();
    if (skip === false) player.play();
  }, [skip, player, onDone]);

  useEventListener(player, 'playToEnd', onDone);
  // Never hold the app hostage if the video cannot play.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onDone();
  });
  useEffect(() => {
    const t = setTimeout(onDone, 7000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (skip !== false) return null;

  return (
    <Animated.View exiting={FadeOut.duration(260)} style={{ position: 'absolute', inset: 0, backgroundColor: '#f2f1ed', zIndex: 50 }}>
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
    </Animated.View>
  );
}
