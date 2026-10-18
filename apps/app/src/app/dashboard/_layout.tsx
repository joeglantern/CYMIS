import { Redirect, Slot, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useView } from '@/auth/view';
import { Sidebar, TopNav } from '@/features/dash/Sidebar';
import { useLayout, useTheme } from '@/theme/theme';
import { breakpoints, fonts, radius } from '@/theme/tokens';
import { Button, Icon, Txt } from '@/ui';

/** Supervisor and admin shell: sidebar on wide screens, a top bar under 960 px. */
export default function DashboardLayout() {
  const { c } = useTheme();
  const { width } = useLayout();
  const insets = useSafeAreaInsets();
  const { view } = useView();
  if (view === 'AUDITOR') return <Redirect href="/audits" />;
  const wide = width >= breakpoints.sidebar;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: wide ? 'row' : 'column',
        backgroundColor: c.paper,
        // Keep clear of the notch, the Dynamic Island and the home bar.
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {wide ? <Sidebar /> : <TopNav />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const isMac = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function TopBar() {
  const { c } = useTheme();
  const { width } = useLayout();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const narrow = width < 700;

  // Ctrl K or Cmd K jumps to the container search from anywhere.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = () => {
    const n = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (n.length < 4) return;
    router.push(`/dashboard/containers?n=${n}` as never);
    setQ('');
    input.current?.blur();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: narrow ? 16 : 32,
        borderBottomWidth: 1,
        borderBottomColor: c.rule,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 420,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          backgroundColor: c.paper2,
          borderWidth: 1,
          borderColor: focused ? c.accent : c.rule,
        }}
      >
        <Icon name="magnifying-glass" size={18} color={c.muted} />
        <TextInput
          ref={input}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={go}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Find a container number"
          placeholderTextColor={c.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Find a container number"
          style={{ flex: 1, minWidth: 0, color: c.ink, fontFamily: fonts.regular, fontSize: 14, outlineStyle: 'none' } as object}
        />
        {Platform.OS === 'web' && !narrow ? (
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.raised, borderWidth: 1, borderColor: c.rule }}>
            <Txt style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }} tone="ink2">
              {isMac ? 'Cmd K' : 'Ctrl K'}
            </Txt>
          </View>
        ) : null}
      </View>
      <Button label={narrow ? 'New' : 'New audit'} icon="plus" onPress={() => router.push('/dashboard/audits/new' as never)} />
    </View>
  );
}
