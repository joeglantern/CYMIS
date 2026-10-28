import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/feedback';
import { APP_VERSION, useAppConfig, useUpdateState } from '@/state/appConfig';
import { useTheme } from '@/theme/theme';
import { Button, EmptyState, Icon, IconButton, Txt } from '@/ui';

/** Gets the newest version: reload the page on the web, an over the air update on a phone. */
async function getNewest(): Promise<'reloading' | 'none' | 'failed'> {
  if (Platform.OS === 'web') {
    window.location.reload();
    return 'reloading';
  }
  if (!Updates.isEnabled) return 'none';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'none';
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return 'reloading';
  } catch {
    return 'failed';
  }
}

/**
 * Sits over the whole app. Blocks a version the server says is too old, and
 * otherwise shows a quiet bar for a newer version or a notice from the office.
 */
export function UpdateGate() {
  const state = useUpdateState();
  const notice = useAppConfig((s) => (s.config?.notice && s.config.notice !== s.dismissedNotice ? s.config.notice : null));

  if (state === 'blocked') return <Blocked />;
  if (state === 'available') return <TopBar text="A newer version of Cymis is ready." action="Update" onAction={getNewest} onClose={closeUpdate} />;
  if (notice) return <TopBar text={notice} onClose={() => useAppConfig.setState({ dismissedNotice: notice })} />;
  return null;
}

function closeUpdate() {
  useAppConfig.setState((s) => ({ dismissedUpdate: s.config?.latestVersion ?? null }));
}

function Blocked() {
  const { c } = useTheme();
  const min = useAppConfig((s) => s.config?.minVersion);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const update = async () => {
    setBusy(true);
    const result = await getNewest();
    setBusy(false);
    if (result === 'none') setNote('No update has reached this phone yet. Ask your supervisor for the new version.');
    if (result === 'failed') {
      feedback.error();
      setNote('The update could not download. Check your signal and try again.');
    }
  };

  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 60, backgroundColor: c.paper, justifyContent: 'center', padding: 16 }}>
      <EmptyState
        icon="arrow-circle-up"
        title="Update Cymis to keep scanning"
        body={`This is version ${APP_VERSION}. The yard now needs ${min ?? 'a newer one'}, so scans stay correct. Your saved scans are kept.`}
        action={
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            <Button label="Update now" size="lg" block loading={busy} onPress={() => void update()} />
            {note ? (
              <Txt variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>
                {note}
              </Txt>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function TopBar({ text, action, onAction, onClose }: { text: string; action?: string; onAction?: () => unknown; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(180)}
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 55,
        alignSelf: 'center',
        maxWidth: 560,
        marginHorizontal: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingLeft: 14,
        paddingRight: 6,
        borderRadius: 14,
        backgroundColor: c.ink,
      }}
    >
      <Icon name="info" size={18} color={c.onInk} />
      <Txt variant="bodySm" color={c.onInk} style={{ flex: 1 }}>
        {text}
      </Txt>
      {action && onAction ? <Button label={action} variant="secondary" onPress={() => void onAction()} /> : null}
      <IconButton icon="x" label="Close" size={36} color={c.onInk} onPress={onClose} />
    </Animated.View>
  );
}
