import { Composition } from 'remotion';
import { DURATION, FPS, Wide } from './Wide';

export function Root() {
  return <Composition id="Wide" component={Wide} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />;
}
