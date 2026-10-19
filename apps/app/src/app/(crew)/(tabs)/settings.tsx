import Constants from 'expo-constants';
import { useState } from 'react';
import { ChangePasswordSheet } from '@/features/crew/ChangePasswordSheet';
import { ViewSwitcher } from '@/features/shell/ViewSwitcher';
import { useView } from '@/auth/view';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { IS_WEB } from '@/api/http';
import { session, useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { SyncButton } from '@/features/crew/CrewHeader';
import { GlassBar, LargeTitle, useHeaderScroll, useTabSpace } from '@/features/crew/GlassHeader';
import { useQueue, wipeLocalData } from '@/offline/engine';
import { useSettings, type ThemePreference } from '@/state/settings';
import { useLayout, useTheme } from '@/theme/theme';
import { Avatar, Button, Divider, FilterPills, NavRow, SectionTitle, ToggleRow, Txt, useConfirm } from '@/ui';

const roleWords = { AUDITOR: 'Yard crew', SUPERVISOR: 'Supervisor', ADMIN: 'Admin' } as const;

export default function Settings() {
  const { c } = useTheme();
  const { gutter } = useLayout();
  const user = useSession((s) => s.user);
  const settings = useSettings();
  const queued = useQueue((s) => s.queued + s.rejected);
  const confirm = useConfirm();
  const [pwOpen, setPwOpen] = useState(false);
  const { y, onScroll } = useHeaderScroll();
  const tabSpace = useTabSpace();
  const { canSwitch } = useView();

  const signOut = async () => {
    if (queued > 0) {
      const ok = await confirm({
        title: `${queued} scans are not sent yet`,
        body: 'If you sign out now they are deleted from this phone and never reach the server. Wait until you have signal and they send by themselves.',
        confirmLabel: 'Sign out and delete them',
        cancelLabel: 'Keep them and stay',
        danger: true,
      });
      if (!ok) return;
    } else {
      const ok = await confirm({ title: 'Sign out?', body: 'You will need your staff ID and password to get back in.', confirmLabel: 'Sign out' });
      if (!ok) return;
    }
    await wipeLocalData();
    await session.signOut();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <GlassBar y={y} title="Settings" right={<SyncButton compact />} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: tabSpace }}>
      <LargeTitle title="Settings" />
      <View style={{ paddingHorizontal: gutter, paddingTop: 8, gap: 28, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        {user ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={user.fullName} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{user.fullName}</Txt>
              <Txt variant="monoSm" tone="muted">{`${user.staffId}, ${roleWords[user.role]}`}</Txt>
            </View>
          </View>
        ) : null}

        {canSwitch ? (
          <View style={{ gap: 12 }}>
            <SectionTitle title="Switch view" small />
            <ViewSwitcher label={false} />
            <Txt variant="caption" tone="muted">
              See the dashboard, or come back here to scan. What you are allowed to change stays the same.
            </Txt>
          </View>
        ) : null}

        <View>
          <SectionTitle title="While scanning" small />
          {!IS_WEB ? (
            <ToggleRow
              icon="vibrate"
              title="Vibrate"
              detail="A firm buzz when a number locks, a different one for each result."
              value={settings.haptics}
              onChange={(v) => {
                settings.set({ haptics: v });
                if (v) feedback.success();
              }}
            />
          ) : null}
          {!IS_WEB ? <Divider /> : null}
          <ToggleRow
            icon={settings.sound ? 'speaker-high' : 'speaker-slash'}
            title="Sounds"
            detail="Short tones you can hear over the yard. Follows the phone's silent switch."
            value={settings.sound}
            onChange={(v) => {
              settings.set({ sound: v });
              if (v) setTimeout(() => feedback.found(), 50);
            }}
          />
          {!IS_WEB ? (
            <Divider />
          ) : null}
          {!IS_WEB ? (
            <ToggleRow icon="sun" title="Keep the screen on" detail="Only while the scanner is open." value={settings.keepAwake} onChange={(v) => settings.set({ keepAwake: v })} />
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          <SectionTitle title="Look" small />
          <FilterPills<ThemePreference>
            label="Theme"
            value={settings.theme}
            onChange={(v) => settings.set({ theme: v })}
            options={[
              { id: 'system', label: 'Match the phone' },
              { id: 'light', label: 'Light' },
              { id: 'graphite', label: 'Graphite' },
            ]}
          />
          <Txt variant="caption" tone="muted">
            Light reads best in direct sun. Graphite is easier on the eyes at night.
          </Txt>
        </View>

        <View>
          <SectionTitle title="Help and account" small />
          <NavRow icon="cloud-arrow-up" title="Send queue" detail={queued > 0 ? `${queued} not sent yet` : 'Everything is sent'} onPress={() => router.push('/(crew)/sync')} />
          <Divider />
          <NavRow icon="book-open" title="How to use Cymis" onPress={() => router.push('/help')} />
          <Divider />
          <NavRow icon="scroll" title="Terms and privacy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
          <Divider />
          <NavRow icon="key" title="Change password" detail="Forgot it? Your supervisor can reset it." onPress={() => setPwOpen(true)} />
        </View>

        <Button label="Sign out" icon="sign-out" variant="danger-quiet" size="lg" block onPress={signOut} />

        <Txt variant="caption" tone="muted" align="center">
          {`Cymis ${Constants.expoConfig?.version ?? ''} on ${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'the web'}`}
        </Txt>
      </View>
      </Animated.ScrollView>
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </View>
  );
}
