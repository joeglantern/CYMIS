import { Redirect } from 'expo-router';
import { useView } from '@/auth/view';

/**
 * Phones and tablets open the crew app. In a browser, supervisors and admins
 * land on the dashboard and crew get the same screens as on the phone.
 */
export default function Index() {
  const { view } = useView();
  if (view !== 'AUDITOR') return <Redirect href="/dashboard" />;
  return <Redirect href="/audits" />;
}
