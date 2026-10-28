import { loadFont } from '@remotion/google-fonts/Geist';
import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const { fontFamily } = loadFont('normal', { weights: ['500', '600'], subsets: ['latin'] });

// The phone film taken apart for wide screens. Three beats play side by side
// as tall panels, then the last one (the C) grows into the left 58% of the
// screen, exactly where the desktop sign in shows the same picture.

export const FPS = 30;
export const DURATION = 132; // 4.4 s
const W = 1920;
const H = 1080;

const PAPER = '#ffffff';
const INK = '#0e0e0e';
const MUTED = '#6f6d66';

// Panels while side by side.
const PANEL_W = 540;
const PANEL_H = 820;
const GAP = 36;
const ROW_LEFT = (W - (PANEL_W * 3 + GAP * 2)) / 2;
const PANEL_TOP = 92;

// Where the C panel ends: the sign in's picture column.
const END_W = Math.round(W * 0.58);

// Beats from the source film (seconds), each trimmed to about 1.8 s.
// Played a little slower, so each panel holds its own moment.
const RATE = 0.72;
const BEATS = [
  { from: 0.15, caption: 'Scan the box' },
  { from: 1.55, caption: 'Match the list' },
  { from: 2.95, caption: 'Know the yard' },
];

const ENTER_AT = [0, 5, 10];
const MERGE_AT = 64; // frame the panels start to resolve into the sign in

const soft = (frame: number, at: number, fps: number, damping = 200) => spring({ frame: frame - at, fps, config: { damping, mass: 0.9, stiffness: 120 } });

function Panel({ index, style, children }: { index: number; style: CSSProperties; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#39383a',
        ...style,
      }}
      data-panel={index}
    >
      {children}
    </div>
  );
}

function Clip({ from }: { from: number }) {
  // OffthreadVideo plays from `from` seconds; the panel crops it like CSS cover.
  return (
    <OffthreadVideo
      src={staticFile('splash.mp4')}
      startFrom={Math.round(from * FPS)}
      playbackRate={RATE}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

export function Wide() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mergeEase = Easing.bezier(0.2, 0, 0, 1)(Math.min(1, Math.max(0, (frame - MERGE_AT) / 34)));
  // A big layout change glides on one curve with no bounce.
  const merge = mergeEase;

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, fontFamily }}>
      {BEATS.map((beat, i) => {
        const enter = soft(frame, ENTER_AT[i], fps);
        const rise = interpolate(enter, [0, 1], [70, 0]);
        const appear = interpolate(enter, [0, 1], [0, 1]);
        const x0 = ROW_LEFT + i * (PANEL_W + GAP);
        const last = i === BEATS.length - 1;

        if (!last) {
          // The first two step aside to the left and fade as the C takes over.
          const away = interpolate(mergeEase, [0, 1], [0, -260 - i * 120]);
          const fade = interpolate(mergeEase, [0, 0.7], [1, 0], { extrapolateRight: 'clamp' });
          return (
            <Panel
              key={i}
              index={i}
              style={{
                left: x0 + away,
                top: PANEL_TOP + rise,
                width: PANEL_W,
                height: PANEL_H,
                borderRadius: 22,
                opacity: appear * fade,
                transform: `scale(${interpolate(mergeEase, [0, 1], [1, 0.94])})`,
              }}
            >
              <Clip from={beat.from} />
            </Panel>
          );
        }

        // The C grows from its slot into the full height picture column.
        const left = interpolate(merge, [0, 1], [x0, 0]);
        const top = interpolate(merge, [0, 1], [PANEL_TOP + rise, 0]);
        const width = interpolate(merge, [0, 1], [PANEL_W, END_W]);
        const height = interpolate(merge, [0, 1], [PANEL_H, H]);
        const radius = interpolate(merge, [0, 1], [22, 0]);
        // After its beat ends the panel holds the still the sign in uses.
        const still = frame >= MERGE_AT;
        return (
          <Panel key={i} index={i} style={{ left, top, width, height, borderRadius: radius, opacity: appear }}>
            {still ? <Img src={staticFile('poster.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Clip from={beat.from} />}
          </Panel>
        );
      })}

      {/* Captions under the panels, in the order the crew lives them. */}
      {BEATS.map((beat, i) => {
        const enter = soft(frame, ENTER_AT[i] + 8, fps);
        const out = interpolate(frame, [MERGE_AT - 4, MERGE_AT + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div
            key={`c${i}`}
            style={{
              position: 'absolute',
              left: ROW_LEFT + i * (PANEL_W + GAP),
              top: PANEL_TOP + PANEL_H + 34 + interpolate(enter, [0, 1], [18, 0]),
              width: PANEL_W,
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              opacity: enter * out,
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 22, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>0{i + 1}</span>
            <span style={{ fontWeight: 600, fontSize: 30, color: INK, letterSpacing: -0.6 }}>{beat.caption}</span>
          </div>
        );
      })}

      {/* The wordmark lands where the sign in has it. */}
      <div
        style={{
          position: 'absolute',
          left: 50,
          top: 34,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: -0.6,
          color: INK,
          opacity: interpolate(frame, [MERGE_AT + 14, MERGE_AT + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        cymis
      </div>
    </AbsoluteFill>
  );
}
