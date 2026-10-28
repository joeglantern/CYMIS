import { router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { feedback } from '@/feedback';
import { isStaleBundle, reloadForNewVersion, reportError } from '@/lib/report';
import { useTheme } from '@/theme/theme';
import { Button, EmptyState } from '@/ui';

/**
 * Shown in place of a single screen when it crashes. The rest of the app,
 * the tab bar and any scans waiting to send keep working.
 */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  const path = usePathname();

  useEffect(() => {
    // A new version went live while this tab was open: load it, quietly.
    if (isStaleBundle(error) && reloadForNewVersion()) return;
    feedback.error();
    reportError(error, path);
    if (__DEV__) console.error(error);
  }, [error, path]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.paper, padding: 16 }}>
      <EmptyState
        icon="warning-circle"
        title="This screen hit a problem"
        body="Your scans are safe and still sending. Try again, or go back to the start."
        action={
          <View style={{ gap: 8, alignSelf: 'stretch' }}>
            <Button label="Try again" size="lg" block onPress={() => void retry()} />
            <Button label="Go to the start" variant="quiet" size="lg" block onPress={() => router.replace('/')} />
          </View>
        }
      />
    </View>
  );
}
