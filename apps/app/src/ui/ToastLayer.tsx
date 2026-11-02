import type { ReactNode } from 'react';

/** On phones toasts sit in the normal tree. The browser version is ToastLayer.web.tsx. */
export function ToastLayer({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
