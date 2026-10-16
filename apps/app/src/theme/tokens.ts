// Ported from the design system tokens (docs/brand/colours.md). Keep the two
// in step: a colour changes there first, then here.

export const brand = {
  royal: '#2d4bb9',
  yellow: '#f6e61e',
  sky: '#6cb5e2',
  red: '#c7001e',
  gold: '#d2b176',
  skyDeep: '#1f6fa3',
  goldDeep: '#8a6a2e',
  found: '#1f7a4d',
  camera: '#0e0e0e',
  cameraRaised: '#222221',
  cameraMuted: '#b5b3ad',
  white: '#ffffff',
} as const;

export interface Palette {
  paper: string;
  paper2: string;
  raised: string;
  hover: string;
  rule: string;
  ruleStrong: string;
  ink: string;
  ink2: string;
  muted: string;
  onInk: string;
  accent: string;
  onAccent: string;
  scrim: string;
  /** Text colour for errors. Red on light, ink on graphite (the icon stays red). */
  dangerText: string;
  found: string;
  missing: string;
  unexpected: string;
  review: string;
  onStatus: string;
  onUnexpected: string;
}

export const light: Palette = {
  paper: '#ffffff',
  paper2: '#f7f7f5',
  raised: '#ffffff',
  hover: '#f1f0ec',
  rule: '#e6e5e1',
  ruleStrong: '#c9c7c0',
  ink: '#0e0e0e',
  ink2: '#3d3d3a',
  muted: '#6e6d68',
  onInk: '#ffffff',
  accent: brand.royal,
  onAccent: '#ffffff',
  scrim: 'rgba(14, 14, 14, 0.40)',
  dangerText: brand.red,
  found: brand.found,
  missing: brand.red,
  unexpected: brand.yellow,
  review: brand.royal,
  onStatus: '#ffffff',
  onUnexpected: '#0e0e0e',
};

export const graphite: Palette = {
  paper: '#111110',
  paper2: '#191918',
  raised: '#222221',
  hover: '#2a2a28',
  rule: '#3b3a37',
  ruleStrong: '#494844',
  ink: '#eeeeec',
  ink2: '#cfcdc7',
  muted: '#b5b3ad',
  onInk: '#111110',
  accent: brand.yellow,
  onAccent: '#0e0e0e',
  scrim: 'rgba(0, 0, 0, 0.60)',
  dangerText: '#eeeeec',
  found: brand.found,
  missing: brand.red,
  unexpected: brand.yellow,
  review: brand.royal,
  onStatus: '#ffffff',
  onUnexpected: '#0e0e0e',
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, sheet: 24, full: 999 } as const;

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/** Type scale from the design system. Sizes and line heights in px. */
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 48, lineHeight: 52, letterSpacing: -0.96 },
  titleLg: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.48 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.24 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySmStrong: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.72 },
  stat: { fontFamily: fonts.monoMedium, fontSize: 48, lineHeight: 52, letterSpacing: -0.96 },
  containerLg: { fontFamily: fonts.monoMedium, fontSize: 28, lineHeight: 34, letterSpacing: 0.56 },
  container: { fontFamily: fonts.monoMedium, fontSize: 16, lineHeight: 22, letterSpacing: 0.32 },
  monoSm: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof type;

/** Screen width breakpoints, the same ones the canvas designs use. */
export const breakpoints = { tablet: 700, wide: 1000, sidebar: 960 } as const;

/** Two soft layers, only on things that float. */
export function floatShadow(dark: boolean) {
  return {
    boxShadow: dark
      ? '0px 1px 2px rgba(0, 0, 0, 0.40), 0px 8px 24px rgba(0, 0, 0, 0.35)'
      : '0px 1px 2px rgba(14, 14, 14, 0.06), 0px 8px 24px rgba(14, 14, 14, 0.06)',
  } as const;
}

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
