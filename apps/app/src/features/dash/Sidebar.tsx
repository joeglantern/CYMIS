import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, Extrapolation, FadeIn, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAudits } from '@/api/queries';
import { session, useSession } from '@/auth/session';
import { useView } from '@/auth/view';
import { DevicesSheet } from '@/features/account/DevicesSheet';
import { ViewSwitcher } from '@/features/shell/ViewSwitcher';
import { feedback } from '@/feedback';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/theme';
import { brand, fonts, radius } from '@/theme/tokens';
import { Avatar, Button, Icon, Sheet, Txt, useConfirm, type IconName } from '@/ui';
import { roleWords } from './format';
import { Mark } from './Page';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Other paths that should light this item up. */
  match?: string[];
}

function useNav(): { main: NavItem[]; admin: NavItem[] } {
  const { view } = useView();
  const active = useAudits({ status: 'ACTIVE' });
  const pending = (active.data?.items ?? []).reduce((n, a) => n + a.counts.pendingReview, 0);
  const main: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: 'squares-four' },
    { href: '/dashboard/audits', label: 'Audits', icon: 'list-checks' },
    { href: '/dashboard/review', label: 'Review queue', icon: 'warning-circle', badge: pending },
    { href: '/dashboard/containers', label: 'Containers', icon: 'shipping-container' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'file-pdf' },
    { href: '/dashboard/people', label: 'People', icon: 'users' },
  ];
  const admin: NavItem[] =
    view === 'ADMIN'
      ? [
          { href: '/dashboard/admin/sections', label: 'Sections', icon: 'buildings' },
          { href: '/dashboard/admin/mappings', label: 'Column mappings', icon: 'columns' },
          { href: '/dashboard/admin/integrations', label: 'Integrations', icon: 'key' },
          { href: '/dashboard/admin/activity', label: 'Activity log', icon: 'scroll' },
        ]
      : [];
  return { main, admin };
}

function isActive(path: string, href: string) {
  if (href === '/dashboard') return path === '/dashboard' || path === '/dashboard/';
  return path === href || path.startsWith(`${href}/`);
}

function NavLink({ item, compact, onActiveLayout }: { item: NavItem; compact?: boolean; onActiveLayout?: (x: number) => void }) {
  const { c } = useTheme();
  const path = usePathname();
  const on = isActive(path, item.href);
  return (
    <Pressable
      onLayout={on && onActiveLayout ? (e) => onActiveLayout(e.nativeEvent.layout.x) : undefined}
      accessibilityRole="link"
      accessibilityState={{ selected: on }}
      accessibilityLabel={item.badge ? `${item.label}, ${item.badge} waiting` : item.label}
      onPress={() => {
        if (!on) feedback.select();
        router.push(item.href as never);
      }}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 40,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: on ? c.raised : (state as { hovered?: boolean }).hovered ? c.hover : 'transparent',
        boxShadow: on ? `inset 0px 0px 0px 1px ${c.rule}` : undefined,
      })}
    >
      <Icon name={item.icon} size={20} weight={on ? 'fill' : 'regular'} color={on ? c.ink : c.ink2} />
      <Txt
        numberOfLines={1}
        color={on ? c.ink : c.ink2}
        style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, lineHeight: 18, flex: compact ? undefined : 1 }}
      >
        {item.label}
      </Txt>
      {item.badge ? (
        <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: brand.royal, alignItems: 'center', justifyContent: 'center' }}>
          <Txt color="#ffffff" style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }}>
            {item.badge > 99 ? '99+' : item.badge}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

function useSignOut() {
  const confirm = useConfirm();
  return async () => {
    const ok = await confirm({
      title: 'Sign out?',
      body: 'You will need your staff ID and password to sign back in.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      danger: true,
    });
    if (ok) await session.signOut();
  };
}

// Sidebar sizes. Icons sit at the same x in both, so nothing jumps.
const OPEN_W = 244;
const RAIL_W = 68;
const isMacKeys = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT = isMacKeys ? '[ or Cmd B' : '[ or Ctrl B';
// The "emphasised" curve big design systems use for things that change size.
const EASE = Easing.bezier(0.2, 0, 0, 1);

type Progress = SharedValue<number>;

/** Labels go first when closing and come back last when opening. */
function useLabelFade(p: Progress) {
  return useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.45], [1, 0], Extrapolation.CLAMP) }));
}

/** A name card that floats beside a rail icon on hover, with the shortcut if there is one. */
function RailTip({ label, hint }: { label: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: RAIL_W - 6,
        top: '50%',
        transform: [{ translateY: -15 }],
        zIndex: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 30,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: c.ink,
      }}
    >
      <Txt variant="bodySm" color={c.onInk} numberOfLines={1} style={{ fontFamily: fonts.medium }}>
        {label}
      </Txt>
      {hint ? (
        <Txt variant="label" color={c.onInk} style={{ opacity: 0.6, letterSpacing: 0 }}>
          {hint}
        </Txt>
      ) : null}
    </Animated.View>
  );
}

function RailRow({
  icon,
  label,
  p,
  collapsed,
  on,
  badge,
  muted,
  height = 40,
  onPress,
  role = 'link',
}: {
  icon: IconName;
  label: string;
  p: Progress;
  collapsed: boolean;
  on?: boolean;
  badge?: number;
  muted?: boolean;
  height?: number;
  onPress: () => void;
  role?: 'link' | 'button';
}) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  const fade = useLabelFade(p);
  const dot = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.55, 1], [0, 1], Extrapolation.CLAMP) }));
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height,
        paddingHorizontal: 12,
        borderRadius: radius.sm,
        backgroundColor: on ? c.raised : hover ? c.hover : 'transparent',
        boxShadow: on ? `inset 0px 0px 0px 1px ${c.rule}` : undefined,
      }}
    >
      <View>
        <Icon name={icon} size={muted ? 18 : 20} weight={on ? 'fill' : 'regular'} color={on ? c.ink : muted ? c.muted : c.ink2} />
        {badge ? (
          <Animated.View
            style={[{ position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: brand.royal, borderWidth: 1.5, borderColor: c.paper2 }, dot]}
          />
        ) : null}
      </View>
      <Animated.View style={[{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, fade]}>
        <Txt
          numberOfLines={1}
          color={on ? c.ink : muted ? c.muted : c.ink2}
          style={{ flex: 1, fontFamily: on ? fonts.semibold : fonts.medium, fontSize: muted ? 13 : 14, lineHeight: 18 }}
        >
          {label}
        </Txt>
        {badge ? (
          <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: brand.royal, alignItems: 'center', justifyContent: 'center' }}>
            <Txt color="#ffffff" style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }}>
              {badge > 99 ? '99+' : badge}
            </Txt>
          </View>
        ) : null}
      </Animated.View>
      {collapsed && hover ? <RailTip label={badge ? `${label} (${badge})` : label} /> : null}
    </Pressable>
  );
}

/**
 * Full sidebar for wide screens. It folds into an icon rail with [ or
 * Ctrl/Cmd B, from the button beside the logo, or from the logo when folded.
 * Labels fade first, then the width glides; opening runs the other way.
 */
export function Sidebar() {
  const { c } = useTheme();
  const path = usePathname();
  const user = useSession((s) => s.user);
  const { main, admin } = useNav();
  const signOut = useSignOut();
  const [devices, setDevices] = useState(false);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const reduce = useReducedMotion();
  const p = useSharedValue(collapsed ? 1 : 0);
  const [logoHover, setLogoHover] = useState(false);

  const toggle = useCallback(() => {
    feedback.select();
    useSettings.getState().set({ sidebarCollapsed: !useSettings.getState().sidebarCollapsed });
  }, []);

  useEffect(() => {
    p.value = reduce ? (collapsed ? 1 : 0) : withTiming(collapsed ? 1 : 0, { duration: collapsed ? 240 : 280, easing: EASE });
  }, [collapsed, reduce, p]);

  // Keyboard: [ like Linear, or Ctrl/Cmd B like most editors. Never while typing.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const bracket = e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey;
      const modB = e.key.toLowerCase() === 'b' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      if (bracket || modB) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const width = useAnimatedStyle(() => ({ width: interpolate(p.value, [0, 1], [OPEN_W, RAIL_W]) }));
  const fade = useLabelFade(p);
  const toggleFade = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.35], [1, 0], Extrapolation.CLAMP) }));
  const rule = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) }));
  const go = (href: string) => {
    if (!isActive(path, href)) feedback.select();
    router.push(href as never);
  };

  return (
    <Animated.View
      role="navigation"
      style={[{ gap: 24, paddingVertical: 20, paddingHorizontal: 10, backgroundColor: c.paper2, borderRightWidth: 1, borderRightColor: c.rule, zIndex: 10 }, width]}
    >
      {/* Logo and name, with the fold button on the right. Folded, the logo itself unfolds it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 36 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand sidebar' : 'Cymis overview'}
          accessibilityState={{ expanded: !collapsed }}
          onPress={collapsed ? toggle : () => go('/dashboard')}
          onHoverIn={() => setLogoHover(true)}
          onHoverOut={() => setLogoHover(false)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 36,
            paddingHorizontal: 12,
            borderRadius: radius.sm,
            backgroundColor: collapsed && logoHover ? c.hover : 'transparent',
            flex: 1,
            minWidth: 0,
          }}
        >
          <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            {collapsed && logoHover ? <Icon name="sidebar-simple" size={20} color={c.ink} /> : <Mark size={24} />}
          </View>
          <Animated.View style={[{ flex: 1, minWidth: 0 }, fade]}>
            <Txt numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.38 }}>
              cymis
            </Txt>
          </Animated.View>
          {collapsed && logoHover ? <RailTip label="Expand sidebar" hint={SHORTCUT} /> : null}
        </Pressable>
        <Animated.View style={toggleFade} pointerEvents={collapsed ? 'none' : 'auto'}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse sidebar"
            accessibilityState={{ expanded: !collapsed }}
            onPress={toggle}
            hitSlop={6}
            style={(s) => ({
              width: 32,
              height: 32,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
            })}
          >
            <Icon name="sidebar-simple" size={18} color={c.muted} />
          </Pressable>
        </Animated.View>
      </View>

      <ScrollView style={{ flex: 1, overflow: 'visible' }} contentContainerStyle={{ gap: 2 }} showsVerticalScrollIndicator={false}>
        {main.map((i) => (
          <RailRow key={i.href} icon={i.icon} label={i.label} badge={i.badge} p={p} collapsed={collapsed} on={isActive(path, i.href)} onPress={() => go(i.href)} />
        ))}
        {admin.length ? (
          <>
            <View style={{ height: 34, justifyContent: 'flex-end', paddingBottom: 6, paddingHorizontal: 12 }}>
              <Animated.View style={fade}>
                <Txt variant="label" tone="muted" caps numberOfLines={1}>
                  Admin
                </Txt>
              </Animated.View>
              {/* Folded, a short rule stands in for the heading. */}
              <Animated.View style={[{ position: 'absolute', left: 14, bottom: 12, width: 20, height: 1, backgroundColor: c.ruleStrong }, rule]} />
            </View>
            {admin.map((i) => (
              <RailRow key={i.href} icon={i.icon} label={i.label} p={p} collapsed={collapsed} on={isActive(path, i.href)} onPress={() => go(i.href)} />
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={{ gap: 2 }}>
        {collapsed ? null : (
          <Animated.View entering={FadeIn.delay(160).duration(180)} style={{ paddingHorizontal: 4, paddingBottom: 10 }}>
            <ViewSwitcher iconless />
          </Animated.View>
        )}
        <RailRow icon="question" label="Help and guides" muted height={36} p={p} collapsed={collapsed} onPress={() => router.push('/help')} />
        <RailRow icon="device-mobile" label="Signed in devices" muted height={36} role="button" p={p} collapsed={collapsed} onPress={() => setDevices(true)} />
        <DevicesSheet open={devices} onClose={() => setDevices(false)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.rule }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? `${user?.fullName ?? 'Account'}, expand sidebar` : (user?.fullName ?? 'Account')}
            onPress={collapsed ? toggle : undefined}
            disabled={!collapsed}
          >
            <Avatar name={user?.fullName ?? 'Cymis'} size={32} />
          </Pressable>
          <Animated.View style={[{ flex: 1, minWidth: 0 }, fade]}>
            <Txt variant="bodySmStrong" numberOfLines={1}>
              {user?.fullName}
            </Txt>
            <Txt variant="label" tone="muted" numberOfLines={1} style={{ letterSpacing: 0 }}>
              {user ? roleWords[user.role] : ''}
            </Txt>
          </Animated.View>
          <Animated.View style={toggleFade} pointerEvents={collapsed ? 'none' : 'auto'}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={signOut}
              hitSlop={6}
              style={(s) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
              })}
            >
              <Icon name="sign-out" size={18} color={c.ink2} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

/** The same navigation as a scrolling bar for screens under 960 px. */
export function TopNav() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const { main, admin } = useNav();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState(false);
  const bar = useRef<ScrollViewInstance>(null);
  return (
    <View
      role="navigation"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, backgroundColor: c.paper2, borderBottomWidth: 1, borderBottomColor: c.rule }}
    >
      <Pressable accessibilityRole="link" accessibilityLabel="Cymis overview" onPress={() => router.push('/dashboard')}>
        <Mark size={22} />
      </Pressable>
      <ScrollView ref={bar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, alignItems: 'center' }} style={{ flex: 1 }}>
        {[...main, ...admin].map((i) => (
          <NavLink key={i.href} item={i} compact onActiveLayout={(x) => bar.current?.scrollTo({ x: Math.max(0, x - 40), animated: true })} />
        ))}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Your account" onPress={() => setOpen(true)} hitSlop={6}>
        <Avatar name={user?.fullName ?? 'Cymis'} size={32} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} label="Your account" width={400}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user?.fullName ?? 'Cymis'} size={44} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{user?.fullName}</Txt>
            <Txt variant="monoSm" tone="muted">
              {user ? `${user.staffId}, ${roleWords[user.role]}` : ''}
            </Txt>
          </View>
        </View>
        <ViewSwitcher />
        <Button label="Help and guides" variant="secondary" icon="question" block size="lg" onPress={() => { setOpen(false); router.push('/help'); }} />
        <Button label="Signed in devices" variant="secondary" icon="device-mobile" block size="lg" onPress={() => { setOpen(false); setDevices(true); }} />
        <Button label="Sign out" variant="danger-quiet" icon="sign-out" block size="lg" onPress={() => { setOpen(false); void signOut(); }} />
      </Sheet>
      <DevicesSheet open={devices} onClose={() => setDevices(false)} />
    </View>
  );
}
