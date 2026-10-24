import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/feedback';
import { useQueue } from '@/offline/engine';
import { useTheme } from '@/theme/theme';
import { brand, fonts } from '@/theme/tokens';
import { Icon, Txt, type IconName } from '@/ui';

const items: { name: string; label: string; icon: IconName }[] = [
  { name: 'audits', label: 'Audits', icon: 'list-checks' },
  { name: 'history', label: 'History', icon: 'clock-counter-clockwise' },
  { name: 'settings', label: 'Settings', icon: 'gear-six' },
];

export default function CrewTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(props) => <FloatingTabs {...props} />}>
      {items.map((i) => (
        <Tabs.Screen key={i.name} name={i.name} options={{ title: i.label }} />
      ))}
    </Tabs>
  );
}

const spring = LinearTransition.springify().damping(20).stiffness(260);

/**
 * A floating glass capsule over the content. The open tab is a black pill
 * with its name; the others are just icons. The pill glides between them.
 */
function FloatingTabs({
  state,
  navigateToTab,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const rejected = useQueue((s) => s.rejected);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 4, alignItems: 'center' }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          padding: 5,
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(14,14,14,0.08)',
          boxShadow: dark ? '0px 10px 30px rgba(0,0,0,0.45)' : '0px 10px 30px rgba(14,14,14,0.12), 0px 1px 2px rgba(14,14,14,0.06)',
        }}
      >
        <BlurView intensity={70} tint={dark ? 'dark' : 'light'} blurMethod="dimezisBlurViewSdk31Plus" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dark ? 'rgba(34,34,33,0.72)' : 'rgba(255,255,255,0.78)' }}
        />
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
                navigateToTab(route.key);
              }}
              hitSlop={4}
            >
              <Animated.View
                layout={spring}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 48,
                  minWidth: 52,
                  paddingHorizontal: on ? 18 : 14,
                  borderRadius: 999,
                  backgroundColor: on ? c.ink : 'transparent',
                }}
              >
                <View>
                  <Icon name={item.icon} size={22} weight={on ? 'fill' : 'regular'} color={on ? c.onInk : c.ink2} />
                  {item.name === 'history' && rejected > 0 ? (
                    <View
                      style={{ position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: brand.red, borderWidth: 1.5, borderColor: on ? c.ink : c.raised }}
                    />
                  ) : null}
                </View>
                {on ? (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Txt color={c.onInk} style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 }}>
                      {item.label}
                    </Txt>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
