import type { AuditDto } from '@cymis/schemas';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSession } from '@/auth/session';
import { SyncButton } from '@/features/crew/CrewHeader';
import { GlassBar, LargeTitle, useHeaderScroll, useTabSpace } from '@/features/crew/GlassHeader';
import { loadMyAudits } from '@/offline/engine';
import { useLayout, useTheme } from '@/theme/theme';
import { Avatar, Banner, BucketBar, Card, EmptyState, Eyebrow, LiveBadge, Pill, Skeleton, StatusChip, Txt, fmt } from '@/ui';

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  return `${part}, ${name}`;
}

const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

export default function MyAudits() {
  const { gutter, tablet } = useLayout();
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const q = useQuery({ queryKey: ['my-audits'], queryFn: loadMyAudits, refetchInterval: 60_000 });
  const { y, onScroll } = useHeaderScroll();
  const tabSpace = useTabSpace();

  const audits = q.data?.audits ?? [];
  // Running audits first, then ones about to start, then today's closed ones.
  const rank = { ACTIVE: 0, DRAFT: 1, CLOSED: 2, CANCELLED: 3 } as const;
  const now = audits
    .filter((a) => a.status === 'ACTIVE' || a.status === 'DRAFT' || (a.status === 'CLOSED' && isToday(a.closedAt)))
    .sort((a, b) => rank[a.status] - rank[b.status]);
  const earlier = audits.filter((a) => !now.includes(a) && a.status !== 'CANCELLED').slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper2 }}>
      <GlassBar y={y} title="Your audits" right={<SyncButton compact />} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.muted} progressViewOffset={80} />}
      >
        <LargeTitle eyebrow={greeting(user?.fullName.split(' ')[0] ?? 'there')} title="Your audits" />
        {q.data?.fromCache ? (
          <View style={{ marginHorizontal: tablet ? gutter : 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' }}>
            <Banner tone="offline">No signal. Showing the audits saved on this phone.</Banner>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: tablet ? gutter : 16, gap: tablet ? 14 : 12 }}>
        {q.isPending ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={180} radius={14} />
            <Skeleton height={110} radius={14} />
          </View>
        ) : q.isError ? (
          <EmptyState icon="warning-circle" title="Could not load your audits" body={(q.error as Error).message} />
        ) : audits.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title="No audits yet"
            body="When your supervisor gives you an audit it shows up here. Pull down to check again."
          />
        ) : (
          <>
            {now.length ? <Eyebrow>Today</Eyebrow> : null}
            <Grid tablet={tablet}>
              {now.map((a) => (
                <AuditCard key={a.id} audit={a} />
              ))}
            </Grid>
            {earlier.length ? (
              <View style={{ marginTop: 8 }}>
                <Eyebrow>Earlier</Eyebrow>
              </View>
            ) : null}
            <Grid tablet={tablet}>
              {earlier.map((a) => (
                <AuditCard key={a.id} audit={a} />
              ))}
            </Grid>
          </>
        )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Grid({ tablet, children }: { tablet: boolean; children: React.ReactNode }) {
  return <View style={tablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' } : { gap: 12 }}>{children}</View>;
}

function AuditCard({ audit }: { audit: AuditDto }) {
  const { tablet } = useLayout();
  const user = useSession((s) => s.user);
  const k = audit.counts;
  const left = Math.max(0, k.expected - k.found);
  const assigned = audit.assignees.some((p) => p.id === user?.id);
  const others = audit.assignees.filter((p) => p.id !== user?.id);
  const width = tablet ? { flexBasis: 340, flexGrow: 1, maxWidth: 560 } : undefined;
  const sub = `${audit.section.name}, ${audit.section.facility.name}`;

  if (audit.status === 'ACTIVE') {
    return (
      <Card float onPress={() => router.push({ pathname: '/(crew)/audit/[id]', params: { id: audit.id } })} label={`Open ${audit.name}`} style={width}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt style={{ fontSize: 17, lineHeight: 22, fontFamily: 'Geist_600SemiBold' }}>{audit.name}</Txt>
            <Txt variant="bodySm" tone="muted">
              {sub}
            </Txt>
          </View>
          <LiveBadge />
        </View>
        <BucketBar counts={{ found: k.found, review: k.mismatched, unexpected: k.unexpected, missing: 0 }} left={left} legend={false} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Txt variant="bodySm" tone="muted">
            <Txt style={{ fontFamily: 'GeistMono_500Medium', fontSize: 16 }}>{fmt(k.found)}</Txt>
            {` of ${fmt(k.expected)} found`}
          </Txt>
          <Txt variant="monoSm" tone="ink2">{`${fmt(left)} left`}</Txt>
        </View>
        <Crew names={[...(assigned && user ? [user.fullName] : []), ...others.map((o) => o.fullName)]} others={others.length} assigned={assigned} />
      </Card>
    );
  }

  if (audit.status === 'DRAFT') {
    return (
      <Card style={width}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt style={{ fontSize: 17, lineHeight: 22, fontFamily: 'Geist_600SemiBold' }}>{audit.name}</Txt>
            <Txt variant="bodySm" tone="muted">
              {sub}
            </Txt>
          </View>
          <Pill label="Not started" />
        </View>
        <Txt variant="bodySm" tone="ink2">
          The list downloads when your supervisor starts it.
        </Txt>
      </Card>
    );
  }

  return (
    <Card style={width} onPress={() => router.push({ pathname: '/(crew)/audit/[id]', params: { id: audit.id } })} label={`See ${audit.name}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt style={{ fontSize: 17, lineHeight: 22, fontFamily: 'Geist_600SemiBold' }}>{audit.name}</Txt>
          <Txt variant="bodySm" tone="muted">
            {audit.closedAt ? `Closed ${closedWhen(audit.closedAt)}` : sub}
          </Txt>
        </View>
        <Pill label={audit.status === 'CLOSED' ? 'Closed' : 'Cancelled'} filled />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <StatusChip bucket="found" size="sm" label={`${fmt(k.found)} found`} />
        {k.missing > 0 ? <StatusChip bucket="missing" size="sm" label={`${fmt(k.missing)} missing`} /> : null}
        {k.unexpected > 0 ? <StatusChip bucket="unexpected" size="sm" label={`${fmt(k.unexpected)} unexpected`} /> : null}
      </View>
    </Card>
  );
}

function closedWhen(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (isToday(iso)) return `today at ${time}`;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `yesterday at ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Crew({ names, others, assigned }: { names: string[]; others: number; assigned: boolean }) {
  const { c } = useTheme();
  if (!names.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.rule }}>
      <View style={{ flexDirection: 'row' }}>
        {names.slice(0, 4).map((n, i) => (
          <View key={n + i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
            <Avatar name={n} size={26} ring={c.raised} />
          </View>
        ))}
      </View>
      <Txt variant="caption" tone="muted">
        {!assigned
          ? `${others} ${others === 1 ? 'person' : 'people'} on this audit`
          : others === 0
            ? 'Just you on this one'
            : `You and ${others} ${others === 1 ? 'other' : 'others'} on this audit`}
      </Txt>
    </View>
  );
}
