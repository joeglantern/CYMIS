import type { Role } from '@cymis/schemas';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useSettings } from '@/state/settings';
import { useSession } from './session';

// Admins can look at the app the way each role sees it, and supervisors can
// pick up a scanner. This only changes which screens show. What the server
// allows is still decided by the real role on every request.

const ladder: Record<Role, Role[]> = {
  ADMIN: ['ADMIN', 'SUPERVISOR', 'AUDITOR'],
  SUPERVISOR: ['SUPERVISOR', 'AUDITOR'],
  AUDITOR: [],
};

export const viewWords: Record<Role, string> = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', AUDITOR: 'Crew' };

export function defaultView(role: Role): Role {
  // Phones and tablets are scanning tools first. Browsers are for the dashboard.
  if (role === 'AUDITOR') return 'AUDITOR';
  return Platform.OS === 'web' ? role : 'AUDITOR';
}

export function useView() {
  const actual = useSession((s) => s.user?.role) ?? 'AUDITOR';
  const viewAs = useSettings((s) => s.viewAs);
  const options = ladder[actual];
  const view: Role = viewAs && options.includes(viewAs) ? viewAs : defaultView(actual);

  const setView = (next: Role) => {
    useSettings.getState().set({ viewAs: next });
    router.replace(next === 'AUDITOR' ? '/audits' : '/dashboard');
  };

  return { actual, view, options, setView, canSwitch: options.length > 1 };
}
