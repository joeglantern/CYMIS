import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const CONTROLS = 'a,button,[role="button"],[role="link"],[role="radio"]';

/**
 * While there are unsaved changes, a click on the sidebar or the top bar, or
 * Enter in the top bar's search, asks first. If the person says yes, it goes
 * through. Ctrl and middle clicks open a new tab and lose nothing, so they pass.
 * Browser back and reload are not asked about, since the browser's own prompt
 * would be a native dialog. The map page keeps a draft to cover those.
 */
export function useLeaveGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    let letThrough = false;
    const onClick = (e: MouseEvent) => {
      if (letThrough || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const target = e.target as Element | null;
      const control = target?.closest?.(CONTROLS) as HTMLElement | null;
      if (!control) return;
      // Shell only: the page's own controls and any dialog are left alone.
      const main = document.getElementById('main');
      const nav = control.closest('[role="navigation"]');
      const inShell = main?.parentElement?.contains(control) && !main.contains(control);
      if (!nav && !inShell) return;
      e.preventDefault();
      e.stopPropagation();
      void askRef.current().then((ok) => {
        if (!ok) return;
        letThrough = true;
        control.click();
        letThrough = false;
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (letThrough || e.key !== 'Enter') return;
      const input = e.target as HTMLElement | null;
      const main = document.getElementById('main');
      if (input?.tagName !== 'INPUT' || !main?.parentElement?.contains(input) || main.contains(input)) return;
      e.preventDefault();
      e.stopPropagation();
      void askRef.current().then((ok) => {
        if (!ok) return;
        letThrough = true;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        letThrough = false;
      });
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [dirty]);
}
