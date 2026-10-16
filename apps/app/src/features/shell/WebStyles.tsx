import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/theme/theme';

/**
 * Small browser touches React Native cannot express: a solid keyboard focus
 * ring on every control, smooth fonts, the page colour behind overscroll, and
 * no tap flash on touch screens.
 */
export function WebStyles() {
  const { c, dark } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'cymis-web-styles';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      html, body { background: ${c.paper}; color-scheme: ${dark ? 'dark' : 'light'}; }
      body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      * { -webkit-tap-highlight-color: transparent; }
      [role="button"]:focus-visible, [role="link"]:focus-visible, [role="radio"]:focus-visible,
      [role="switch"]:focus-visible, [role="tab"]:focus-visible, a:focus-visible, button:focus-visible {
        outline: 2px solid ${c.accent}; outline-offset: 2px; border-radius: 8px;
      }
      input:focus-visible, textarea:focus-visible { outline: none; }
      ::selection { background: ${dark ? 'rgba(246,230,30,0.35)' : 'rgba(45,75,185,0.18)'}; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
    `;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [c, dark]);
  return null;
}
