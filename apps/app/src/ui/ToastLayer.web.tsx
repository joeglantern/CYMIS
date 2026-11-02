import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Sheets on the web live in their own layers on the page body. Toasts go there
 * too, one step above, so a message is never hidden behind a sheet's dimmer.
 */
export function ToastLayer({ children }: { children: ReactNode }) {
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none', display: 'flex' }}>{children}</div>, document.body);
}
