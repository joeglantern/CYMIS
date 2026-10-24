import { router, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useAudits } from '@/api/queries';
import { session, useSession } from '@/auth/session';
import { useView } from '@/auth/view';
import { ViewSwitcher } from '@/features/shell/ViewSwitcher';
import { feedback } from '@/feedback';
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

/** Full sidebar for wide screens. */
export function Sidebar() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const { main, admin } = useNav();
  const signOut = useSignOut();
  return (
    <View
      role="navigation"
      style={{ width: 244, gap: 28, paddingVertical: 22, paddingHorizontal: 16, backgroundColor: c.paper2, borderRightWidth: 1, borderRightColor: c.rule }}
    >
      <Pressable accessibilityRole="link" accessibilityLabel="Cymis overview" onPress={() => router.push('/dashboard')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 }}>
        <Mark size={24} />
        <Txt style={{ fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.38 }}>cymis</Txt>
      </Pressable>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
        {main.map((i) => (
          <NavLink key={i.href} item={i} />
        ))}
        {admin.length ? (
          <>
            <Txt variant="label" tone="muted" caps style={{ marginTop: 22, marginBottom: 6, paddingHorizontal: 10 }}>
              Admin
            </Txt>
            {admin.map((i) => (
              <NavLink key={i.href} item={i} />
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={{ gap: 4 }}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 10 }}>
          <ViewSwitcher iconless />
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/help')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 10 }}>
          <Icon name="question" size={18} color={c.muted} />
          <Txt variant="bodySm" tone="muted">
            Help and guides
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: c.rule }}>
          <Avatar name={user?.fullName ?? 'Cymis'} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="bodySmStrong" numberOfLines={1}>
              {user?.fullName}
            </Txt>
            <Txt variant="label" tone="muted" style={{ letterSpacing: 0 }}>
              {user ? roleWords[user.role] : ''}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={signOut}
            hitSlop={6}
            style={(s) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent' })}
          >
            <Icon name="sign-out" size={18} color={c.ink2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** The same navigation as a scrolling bar for screens under 960 px. */
export function TopNav() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const { main, admin } = useNav();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
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
        <Button label="Sign out" variant="danger-quiet" icon="sign-out" block size="lg" onPress={() => { setOpen(false); void signOut(); }} />
      </Sheet>
    </View>
  );
}
