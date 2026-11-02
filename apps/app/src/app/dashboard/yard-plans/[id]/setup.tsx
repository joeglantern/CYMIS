import { useLocalSearchParams } from 'expo-router';
import { AuditWizard } from '@/features/dash/AuditWizard';

/** Carry on setting up a draft audit. */
export default function SetupAudit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AuditWizard auditId={id} />;
}
