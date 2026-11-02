import { router } from 'expo-router';
import { Page } from '@/features/dash/Page';
import { Button, EmptyState } from '@/ui';

/** Holding page until shifts are built. It makes no promise about dates and shows no sample data. */
export default function Shifts() {
  return (
    <Page>
      <EmptyState
        icon="clock"
        title="Shift planning"
        body="Shifts are being built. For now, clerks are assigned when a yard plan is set up."
        action={<Button label="Open yard planning" onPress={() => router.push('/dashboard/yard-plans' as never)} />}
      />
    </Page>
  );
}
