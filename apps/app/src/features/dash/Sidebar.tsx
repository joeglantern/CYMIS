import { Link, router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View, type NativeScrollEvent, type ScrollViewInstance, type ViewInstance } from 'react-native';
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
import { Avatar, Button, Icon, Sheet, Txt, useConfirm } from '@/ui';
import { roleWords } from './format';
import { isActive, navFor, type NavGroups, type NavItem } from './nav';
import { Mark } from './Page';

// Tells screen readers which link is this page.
const CURRENT_PAGE = { 'aria-current': 'page' } as object;

function useNav(): NavGroups {
  const { view } = useView();
  const active = useAudits({ status: 'ACTIVE' });
  const pending = (active.data?.items ?? []).reduce((n, a) => n + a.counts.pendingReview, 0);
  return navFor(view === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR', pending);
}

function NavLink({ item, compact, onActiveLayout }: { item: NavItem; compact?: boolean; onActiveLayout?: (x: number) => void }) {
  const { c } = useTheme();
  const path = usePathname();
  const [hover, setHover] = useState(false);
  const on = isActive(path, item);
  return (
    <Link href={item.href as Href} asChild>
      {/* Link asChild drops a function style, so hover lives in state here. */}
      <Pressable
        onLayout={on && onActiveLayout ? (e) => onActiveLayout(e.nativeEvent.layout.x) : undefined}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
        accessibilityLabel={item.badge ? `${item.label}, ${item.badge} waiting` : item.label}
        {...(on ? CURRENT_PAGE : null)}
        onPress={() => {
          if (!on) feedback.select();
        }}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 40,
          paddingHorizontal: 10,
          borderRadius: radius.sm,
          backgroundColor: on ? c.raised : hover ? c.hover : 'transparent',
          boxShadow: on ? `inset 0px 0px 0px 1px ${c.rule}` : undefined,
        }}
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
    </Link>
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
function RailTip({ label, hint, top = '50%' }: { label: string; hint?: string; top?: number | `${number}%` }) {
  const { c } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: RAIL_W - 6,
        top,
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

function RailRow({ item, p, on, onHover }: { item: NavItem; p: Progress; on: boolean; onHover: (label: string | null, node: ViewInstance | null) => void }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  const fade = useLabelFade(p);
  const dot = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.55, 1], [0, 1], Extrapolation.CLAMP) }));
  const row = useRef<ViewInstance>(null);
  const { label, badge, icon } = item;

  // On a short screen the current page can sit below the fold. Keep it in view.
  useEffect(() => {
    if (on && Platform.OS === 'web') (row.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [on]);

  return (
    <Link href={item.href as Href} asChild>
      {/* Link asChild drops a function style, so hover lives in state here. */}
      <Pressable
        ref={row}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
        accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
        {...(on ? CURRENT_PAGE : null)}
        onPress={() => {
          if (!on) feedback.select();
        }}
        onHoverIn={() => {
          setHover(true);
          onHover(badge ? `${label} (${badge})` : label, row.current);
        }}
        onHoverOut={() => {
          setHover(false);
          onHover(null, null);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          backgroundColor: on ? c.raised : hover ? c.hover : 'transparent',
          boxShadow: on ? `inset 0px 0px 0px 1px ${c.rule}` : undefined,
        }}
      >
        <View>
          <Icon name={icon} size={20} weight={on ? 'fill' : 'regular'} color={on ? c.ink : c.ink2} />
          {badge ? (
            <Animated.View
              style={[{ position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: brand.royal, borderWidth: 1.5, borderColor: c.paper2 }, dot]}
            />
          ) : null}
        </View>
        <Animated.View style={[{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, fade]}>
          <Txt numberOfLines={1} color={on ? c.ink : c.ink2} style={{ flex: 1, fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, lineHeight: 18 }}>
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
      </Pressable>
    </Link>
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
  const { main, more } = useNav();
  const signOut = useSignOut();
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
  const goHome = () => {
    if (!isActive(path, { href: '/dashboard' })) feedback.select();
    router.push('/dashboard');
  };

  // The nav list scrolls and so clips what it holds. The folded name card sits
  // outside it, placed against the hovered row, so it can reach past the rail.
  const navBox = useRef<ViewInstance>(null);
  const hovered = useRef<string | null>(null);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const onRowHover = useCallback((label: string | null, node: ViewInstance | null) => {
    hovered.current = label;
    if (!label || !node) return setTip(null);
    node.measureInWindow((_x, y, _w, h) => {
      navBox.current?.measureInWindow((_bx, boxY) => {
        if (hovered.current === label) setTip({ label, top: y - boxY + h / 2 });
      });
    });
  }, []);

  // A hairline shows there is more to scroll to, since the scrollbar stays hidden.
  const scroll = useRef({ y: 0, view: 0, content: 0 });
  const [edges, setEdges] = useState({ above: false, below: false });
  const syncEdges = useCallback(() => {
    const { y, view, content } = scroll.current;
    const above = y > 1;
    const below = y + view < content - 1;
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }));
  }, []);
  const onNavScroll = useCallback(
    (e: { nativeEvent: NativeScrollEvent }) => {
      scroll.current.y = e.nativeEvent.contentOffset.y;
      syncEdges();
      // The rows moved, so the card no longer lines up with one.
      hovered.current = null;
      setTip(null);
    },
    [syncEdges],
  );

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
          onPress={collapsed ? toggle : goHome}
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

      <View ref={navBox} style={{ flex: 1, minHeight: 0, zIndex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 2 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onNavScroll}
          onLayout={(e) => {
            scroll.current.view = e.nativeEvent.layout.height;
            syncEdges();
          }}
          onContentSizeChange={(_w, h) => {
            scroll.current.content = h;
            syncEdges();
          }}
        >
          {main.map((i) => (
            <RailRow key={i.href} item={i} p={p} on={isActive(path, i)} onHover={onRowHover} />
          ))}
          <View style={{ height: 18 }} />
          {more.map((i) => (
            <RailRow key={i.href} item={i} p={p} on={isActive(path, i)} onHover={onRowHover} />
          ))}
        </ScrollView>
        {edges.above ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: c.rule }} /> : null}
        {edges.below ? <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: c.rule }} /> : null}
        {collapsed && tip ? <RailTip label={tip.label} top={tip.top} /> : null}
      </View>

      <View style={{ gap: 2 }}>
        {collapsed ? null : (
          <Animated.View entering={FadeIn.delay(160).duration(180)} style={{ paddingHorizontal: 4, paddingBottom: 10 }}>
            <ViewSwitcher iconless />
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.rule }}>
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
  const { main, more } = useNav();
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
        {[...main, ...more].map((i) => (
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
