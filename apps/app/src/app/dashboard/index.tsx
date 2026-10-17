import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, useAudits } from '@/api/queries';
import { useSession } from '@/auth/session';
import { AuditRow, FeedLine } from '@/features/dash/AuditRows';
import { longDate, minutesAgo } from '@/features/dash/format';
import { Column, Columns, Page, PageHeader, StatGrid } from '@/features/dash/Page';
import { Button, EmptyState, SectionTitle, Skeleton, StatTile } from '@/ui';

export default function Overview() {
  const user = useSession((s) => s.user);
  const active = useAudits({ status: 'ACTIVE' });
  const audits = active.data?.items ?? [];

  // Latest scans from the first few live audits, merged into one feed.
  const feeds = useQueries({
    queries: audits.slice(0, 4).map((a) => ({
      queryKey: [...keys.scans(a.id), { feed: true }],
      queryFn: () => endpoints.scans(a.id, { limit: 8 }),
      refetchInterval: 20_000,
    })),
  });
  const feed = feeds
    .flatMap((f, i) => (f.data?.items ?? []).map((s) => ({ scan: s, auditName: audits[i]?.name ?? '' })))
    .sort((a, b) => (a.scan.capturedAt < b.scan.capturedAt ? 1 : -1))
    .slice(0, 8);

  const sum = (pick: (k: (typeof audits)[number]['counts']) => number) => audits.reduce((n, a) => n + pick(a.counts), 0);
  const scanning = audits.filter((a) => a.counts.scans > 0).length;
  const sections = new Set(audits.map((a) => a.section.id)).size;

  const oldestPending = feed
    .filter((f) => f.scan.reviewStatus === 'PENDING')
    .map((f) => f.scan.capturedAt)
    .sort()[0];

  const firstName = user?.fullName.split(' ')[0];
  const facility = audits[0]?.section.facility.name;

  return (
    <Page refreshing={active.isRefetching} onRefresh={() => active.refetch()}>
      <PageHeader title="Overview" subtitle={[longDate(), facility].filter(Boolean).join(', ') || (firstName ? `Hello, ${firstName}` : undefined)} />

      {active.isPending ? (
        <StatGrid>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: 160 }}>
              <Skeleton height={128} radius={14} />
            </View>
          ))}
        </StatGrid>
      ) : (
        <StatGrid>
          <StatTile label="Active audits" value={audits.length} detail={scanning ? `${scanning} with crew scanning` : 'None scanning yet'} />
          <StatTile label="Scanned" value={sum((k) => k.scans)} detail={sections ? `Across ${sections} ${sections === 1 ? 'section' : 'sections'}` : 'In live audits'} />
          <StatTile label="Not found yet" value={sum((k) => k.missing)} bucket="missing" detail="Still to scan in live audits" />
          <StatTile
            label="Needs review"
            value={sum((k) => k.pendingReview)}
            bucket="review"
            detail={sum((k) => k.pendingReview) === 0 ? 'Nothing waiting' : oldestPending ? `Oldest from ${minutesAgo(oldestPending)}` : 'Waiting for a decision'}
          />
        </StatGrid>
      )}

      <Columns>
        <Column grow={2} basis={520}>
          <SectionTitle title="Active audits" />
          {active.isPending ? (
            <View style={{ gap: 12, paddingTop: 8 }}>
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : active.isError ? (
            <EmptyState icon="warning-circle" title="Could not load audits" body={(active.error as Error).message} />
          ) : audits.length === 0 ? (
            <EmptyState
              icon="list-checks"
              title="No audits running"
              body="Start one from a terminal export and the crew get it on their phones straight away."
              action={<Button label="New audit" icon="plus" onPress={() => router.push('/dashboard/audits/new' as never)} />}
            />
          ) : (
            <View>
              {audits.map((a, i) => (
                <AuditRow key={a.id} audit={a} last={i === audits.length - 1} />
              ))}
            </View>
          )}
        </Column>

        <Column grow={1} basis={280}>
          <SectionTitle title="Latest" aside="Updates every few seconds" />
          {feeds.some((f) => f.isPending) && audits.length ? (
            <View style={{ gap: 12, paddingTop: 8 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </View>
          ) : feed.length === 0 ? (
            <EmptyState icon="scan" title="No scans yet" body="Scans from the yard show up here as they come in." />
          ) : (
            <View>
              {feed.map((f, i) => (
                <FeedLine key={f.scan.id} scan={f.scan} auditName={f.auditName} last={i === feed.length - 1} />
              ))}
            </View>
          )}
        </Column>
      </Columns>
    </Page>
  );
}
