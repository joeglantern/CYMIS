import type { ReactNode } from 'react';
import { useView } from '@/auth/view';
import { EmptyState } from '@/ui';
import { Page } from './Page';

/** Wraps admin pages. Supervisors who follow a link get a plain explanation. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { view } = useView();
  if (view !== 'ADMIN')
    return (
      <Page>
        <EmptyState icon="lock-key" title="Admins only" body="Ask an admin if you need something changed here." />
      </Page>
    );
  return <>{children}</>;
}
