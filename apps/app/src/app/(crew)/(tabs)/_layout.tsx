import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/feedback';
import { useQueue } from '@/offline/engine';
import { useLayout, useTheme } from '@/theme/theme';
import { brand, fonts } from '@/theme/tokens';
import { Icon, Txt, type IconName } from '@/ui';

const items: { name: string; label: string; icon: IconName }[] = [
  { name: 'audits', label: 'Audits', icon: 'list-checks' },
  { name: 'history', label: 'History', icon: 'clock-counter-clockwise' },
  { name: 'settings', label: 'Settings', icon: 'gear-six' },
];

export default function CrewTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {items.map((i) => (
        <Tabs.Screen key={i.name} name={i.name} options={{ title: i.label }} />
      ))}
    </Tabs>
  );
}

function TabBar({ state, navigation }: { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } }) {
  const { c } = useTheme();
  const { tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const rejected = useQueue((s) => s.rejected);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        justifyContent: tablet ? 'center' : 'space-around',
        gap: tablet ? 72 : 0,
        alignItems: 'center',
        height: 66 + Math.max(insets.bottom, 10),
        paddingBottom: Math.max(insets.bottom, 10),
        backgroundColor: c.paper,
        borderTopWidth: 1,
        borderTopColor: c.rule,
      }}
    >
      {state.routes.map((route, index) => {
        const item = items.find((i) => i.name === route.name);
        if (!item) return null;
        const on = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            onPress={() => {
              if (!on) feedback.select();
              navigation.navigate(route.name);
            }}
            style={{ alignItems: 'center', gap: 4, width: 88, paddingTop: 8 }}
          >
            <View>
              <Icon name={item.icon} size={24} weight={on ? 'fill' : 'regular'} color={on ? c.ink : c.muted} />
              {item.name === 'history' && rejected > 0 ? (
                <View style={{ position: 'absolute', top: -2, right: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: brand.red, borderWidth: 2, borderColor: c.paper }} />
              ) : null}
            </View>
            <Txt color={on ? c.ink : c.muted} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 12, lineHeight: 16 }}>
              {item.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
