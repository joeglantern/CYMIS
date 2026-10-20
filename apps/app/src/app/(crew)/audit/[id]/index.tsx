import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryClient } from '@/api/queries';
import { useSession } from '@/auth/session';
import { SyncButton, useSyncState } from '@/features/crew/CrewHeader';
import { ScanRow } from '@/features/crew/ScanRow';
import { localProgress, prepareAudit, recentScans, useQueue } from '@/offline/engine';
import { useAuditRoom } from '@/realtime/socket';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts, type } from '@/theme/tokens';
import { AnimatedNumber, Banner, BucketBar, Button, EmptyState, IconButton, Skeleton, Txt, emptyImages, fmt } from '@/ui';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function AuditHome() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { tablet, gutter } = useLayout();
  const insets = useSafeAreaInsets();
  const version = useQueue((s) => s.version);
  const sync = useSyncState();
  const { present } = useAuditRoom(id, queryClient);
  const me = useSession((s) => s.user?.id);
  const othersHere = present.filter((p) => p.userId !== me);

  const audit = useQuery({ queryKey: ['crew-audit', id], queryFn: () => prepareAudit(id!), enabled: !!id, refetchInterval: 60_000 });
  const local = useQuery({ queryKey: ['local-progress', id, version], queryFn: () => localProgress(id!), enabled: !!id });
  const recent = useQuery({ queryKey: ['recent', id, version], queryFn: () => recentScans(id!, tablet ? 12 : 8), enabled: !!id });

  const a = audit.data;
  // The server count includes everyone's scans. Fall back to this phone's count with no signal.
  const k = a?.counts;
  const expected = k?.expected || local.data?.expected || 0;
  const found = Math.max(k?.found ?? 0, local.data?.matched ?? 0);
  const left = Math.max(0, expected - found);
  const shown = (recent.data ?? []).length;
  const closed = a?.status === 'CLOSED' || a?.status === 'CANCELLED';
  const draft = a?.status === 'DRAFT';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/audits'));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: insets.top + (tablet ? 18 : 14), paddingBottom: tablet ? 12 : 10, paddingLeft: tablet ? 20 : 8, paddingRight: tablet ? 28 : 12 }}>
        <IconButton icon="caret-left" label="Back to your audits" onPress={back} />
        <SyncButton />
      </View>

      {sync.state === 'offline' ? (
        <Banner tone="offline">
          {sync.queued > 0 ? `No signal. Keep scanning; ${sync.queued} scans send when you are back online.` : 'No signal. Keep scanning; scans send when you are back online.'}
        </Banner>
      ) : sync.state === 'error' ? (
        <Banner tone="warning" action={{ label: 'Open', onPress: () => router.push('/(crew)/sync') }}>
          {`${sync.queued} scans were not accepted. Open the queue to fix them.`}
        </Banner>
      ) : closed ? (
        <Banner tone="closed">This audit is closed. You can still look through it.</Banner>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingTop: tablet ? 32 : 18, paddingHorizontal: gutter, paddingBottom: 24, gap: tablet ? 28 : 20 }}
        refreshControl={<RefreshControl refreshing={audit.isRefetching} onRefresh={() => audit.refetch()} tintColor={c.muted} />}
      >
        {audit.isPending ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={32} width="70%" />
            <Skeleton height={16} width="40%" />
            <Skeleton height={110} radius={12} />
          </View>
        ) : !a ? (
          <EmptyState icon="wifi-slash" image={emptyImages.noSignal} title="This audit is not on your phone yet" body="Open it once with signal so the list downloads. After that it works offline." />
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Txt accessibilityRole="header" style={{ fontSize: tablet ? 30 : 26, lineHeight: tablet ? 36 : 32, fontFamily: fonts.semibold, letterSpacing: -0.4 }}>
                {a.name}
              </Txt>
              <Txt variant="bodySm" tone="muted">
                {a.startedAt
                  ? `${a.section.name}, started ${new Date(a.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                  : a.section.name}
              </Txt>
            </View>

            {expected > 0 && left === 0 && !closed ? (
              <Animated.View
                entering={FadeInDown.duration(420)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule }}
              >
                <Image source={emptyImages.auditComplete} contentFit="contain" style={{ width: 72, height: 72 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="bodyStrong">Everything on the list is found</Txt>
                  <Txt variant="bodySm" tone="muted">
                    Your supervisor can close the audit. Keep scanning if you spot boxes that are not on the list.
                  </Txt>
                </View>
              </Animated.View>
            ) : null}
            <View style={tablet ? { flexDirection: 'row', gap: 48, alignItems: 'flex-start' } : { gap: 20 }}>
              <View style={{ flex: tablet ? 1 : undefined, gap: 14, paddingBottom: 18, borderBottomWidth: 2, borderBottomColor: c.ink }} accessibilityLabel="Progress">
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <AnimatedNumber value={found} style={type.stat} />
                  <Txt variant="body" tone="muted" style={{ fontSize: 15 }}>
                    {`of ${fmt(expected)} found`}
                  </Txt>
                </View>
                {closed ? (
                  <BucketBar counts={{ found, review: k?.mismatched ?? 0, unexpected: k?.unexpected ?? 0, missing: k?.missing ?? left }} />
                ) : (
                  <BucketBar counts={{ found, review: k?.mismatched ?? 0, unexpected: k?.unexpected ?? 0, missing: 0 }} left={left} />
                )}
                {othersHere.length > 0 ? (
                  <Txt variant="caption" tone="muted">
                    {othersHere.length === 1 ? `${othersHere[0]!.fullName.split(' ')[0]} is scanning too` : `${othersHere.length} others scanning now`}
                  </Txt>
                ) : null}
              </View>

              <View style={{ flex: tablet ? 1 : undefined, minWidth: 0 }} accessibilityLabel="Your last scans">
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
                  <Txt variant="label" tone="muted" caps accessibilityRole="header">
                    Your last scans
                  </Txt>
                  {shown > 0 ? (
                    <Txt variant="caption" tone="muted">
                      {`Latest ${shown}`}
                    </Txt>
                  ) : null}
                </View>
                {(recent.data ?? []).length === 0 ? (
                  <View style={{ paddingVertical: 18 }}>
                    <Txt variant="bodySm" tone="muted">
                      {draft ? 'The list downloads when your supervisor starts the audit.' : 'Nothing scanned on this phone yet. Tap the button below to start.'}
                    </Txt>
                  </View>
                ) : (
                  recent.data!.map((s, i) => <ScanRow key={s.id} scan={s} fresh={i === 0 && Date.now() - new Date(s.createdAt).getTime() < 8000} />)
                )}
                {(recent.data ?? []).length > 0 ? (
                  <Button label="See all on this phone" variant="quiet" onPress={() => router.push('/history')} style={{ marginTop: 6, marginLeft: -12 }} />
                ) : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {a && !closed && !draft ? (
        <View style={{ paddingTop: tablet ? 18 : 14, paddingHorizontal: gutter, paddingBottom: (tablet ? 32 : 26) + insets.bottom * 0.5, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.rule }}>
          <Button
            label="Scan containers"
            icon="scan"
            size="xl"
            block
            onPress={() => router.push({ pathname: '/(crew)/audit/[id]/scan', params: { id: a.id } })}
            style={tablet ? { maxWidth: 520, alignSelf: 'center', width: '100%', height: 64 } : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}
