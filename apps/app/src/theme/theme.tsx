import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { useSettings } from '@/state/settings';
import { breakpoints, graphite, light, type Palette } from './tokens';

interface Theme {
  c: Palette;
  dark: boolean;
}

const ThemeContext = createContext<Theme>({ c: light, dark: false });

export function ThemeProvider({ children, force }: { children: ReactNode; force?: 'light' | 'dark' }) {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const dark = force ? force === 'dark' : pref === 'system' ? system === 'dark' : pref === 'graphite';
  const value = useMemo(() => ({ c: dark ? graphite : light, dark }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Colours for the current theme. Wrap a subtree in ThemeProvider force="light" to pin it. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export interface Layout {
  width: number;
  height: number;
  /** 700 px and up: tablets in portrait, small laptops. */
  tablet: boolean;
  /** 1000 px and up: tablets in landscape, desktops. */
  wide: boolean;
  landscape: boolean;
  /** Side gutter that grows with the screen. */
  gutter: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const tablet = width >= breakpoints.tablet;
  const wide = width >= breakpoints.wide;
  return { width, height, tablet, wide, landscape: width > height, gutter: tablet ? 40 : 20 };
}
