import { splitLocation, type AuditDto, type Bucket } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, queryClient, useAudit, useProgress, useResults, useScans } from '@/api/queries';
import { feedback } from '@/feedback';
import { dayKey, dayWord, eatTime } from '@/lib/eat';
import { useSettings } from '@/state/settings';
import { AuditStatus } from '@/features/dash/AuditRows';
import { DataTable } from '@/features/dash/DataTable';
import { barProps, dayTime, minutesAgo, time } from '@/features/dash/format';
import { Column, Columns, Page, PageHeader, StatGrid } from '@/features/dash/Page';
import { ReportButton } from '@/features/dash/Reports';
import { resultColumns, scanColumns } from '@/features/dash/scanColumns';
import { SiteMap } from '@/features/dash/SiteMap';
import { LiveBays } from '@/features/dash/YardMap';
import { useAuditRoom } from '@/realtime/socket';
import { useTheme } from '@/theme/theme';
import { Avatar, BucketBar, Button, EmptyState, FilterPills, LiveBadge, SectionTitle, Skeleton, StatTile, TextField, Txt, fmt, useConfirm, useToast } from '@/ui';

export default function LiveAudit() {
  const { id, place: placeParam } = useLocalSearchParams<{ id: string; place?: string }>();
  const place = placeParam ?? null;
  const setPlace = (p: string | null) => router.setParams({ place: p ?? undefined });
  const { c } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const audit = useAudit(id);
  const progress = useProgress(id);
  const { present, connected } = useAuditRoom(id, queryClient);
  const live = audit.data?.status === 'ACTIVE';
  const scans = useScans(id);

  const close = useMutation({
    mutationFn: () => endpoints.closeAudit(id!),
    onSuccess: (a) => {
      feedback.success();
      qc.setQueryData(keys.audit(id!), a);
      void qc.invalidateQueries({ queryKey: ['audits'] });
      toast({ text: 'Yard plan closed. The report is ready to download.', tone: 'success' });
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  if (audit.data?.status === 'DRAFT') return <Redirect href={`/dashboard/yard-plans/${id}/setup` as never} />;

  if (audit.isPending)
    return (
      <Page>
        <Skeleton height={40} width={320} />
        <Skeleton height={130} radius={14} />
        <Skeleton height={240} radius={14} />
      </Page>
    );
  if (audit.isError || !audit.data)
    return (
      <Page>
        <EmptyState icon="warning-circle" title="Could not open this yard plan" body={(audit.error as Error | null)?.message ?? 'It may have been removed.'} />
      </Page>
    );

  const a = audit.data;
  const k = progress.data ?? a.counts;
  // People viewing the page also join the room. Only count the crew on this audit.
  const crewIds = new Set(a.assignees.map((p) => p.id));
  const scanning = present.filter((p) => crewIds.has(p.userId));

  const askClose = async () => {
    const ok = await confirm({
      title: 'Close this yard plan?',
      body:
        k.missing > 0
          ? `${fmt(k.missing)} ${k.missing === 1 ? 'container on the list has' : 'containers on the list have'} not been found. Closing marks them as missing and stops new scans. Scans taken before now still come in from phones that were offline.`
          : 'Every container on the list was found. Closing stops new scans and makes the final report.',
      confirmLabel: 'Close plan',
      cancelLabel: 'Keep it open',
      danger: true,
    });
    if (ok) close.mutate();
  };

  return (
    <Page gap={28} refreshing={audit.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: keys.audit(id!) })}>
      <PageHeader
        crumbs={[{ label: 'Yard planning', href: '/dashboard/yard-plans' }, { label: a.section.name }]}
        title={a.name}
        badge={live ? <LiveBadge label={a.startedAt ? `Live since ${time(a.startedAt)}` : 'Live'} /> : <AuditStatus status={a.status} />}
        subtitle={
          live
            ? connected
              ? undefined
              : 'Reconnecting for live updates...'
            : a.closedAt
              ? `Closed ${dayTime(a.closedAt)}${a.closedBy ? ` by ${a.closedBy.fullName}` : ''}`
              : undefined
        }
        actions={
          <>
            {live ? (
              <Button
                label="Scan"
                icon="scan"
                onPress={() => {
                  // Scanning happens in the crew screens. Switch over and open the camera on this audit.
                  useSettings.getState().set({ viewAs: 'AUDITOR' });
                  router.push(`/audit/${a.id}/scan` as never);
                }}
              />
            ) : null}
            <ReportButton auditId={a.id} />
            {live ? <Button label="Close plan" variant="danger-quiet" loading={close.isPending} onPress={askClose} /> : null}
          </>
        }
      />

      <StatGrid>
        <StatTile compact label="Expected" value={k.expected} detail={`List version ${a.listVersion}`} />
        <StatTile compact label="Found" value={k.found} bucket="found" />
        <StatTile compact label={live ? 'Not found yet' : 'Missing'} value={k.missing} bucket={live ? undefined : 'missing'} detail={live ? 'Still to scan' : undefined} />
        <StatTile compact label="Unexpected" value={k.unexpected} bucket="unexpected" />
        <StatTile compact label="Needs review" value={k.mismatched} bucket="review" detail={k.pendingReview ? `${k.pendingReview} waiting` : undefined} />
      </StatGrid>

      <BucketBar {...barProps(k, live)} />

      <Columns>
        <Column grow={3} basis={520}>
          <LiveBays
            auditId={a.id}
            live={live}
            selected={place}
            onSelect={setPlace}
            title={<SectionTitle title="Bay grid" aside="Each square is one bay. Tap one to see its boxes." />}
          />
        </Column>
        <Column grow={1} basis={260}>
          <SectionTitle title="On it now" />
          {scanning.length === 0 ? (
            <Txt variant="bodySm" tone="muted" style={{ paddingVertical: 14 }}>
              {live ? 'Nobody is scanning right now.' : 'This yard plan is finished.'}
            </Txt>
          ) : (
            scanning.map((p, i) => {
              const recent = Date.now() - new Date(p.lastSeenAt).getTime() < 2 * 60_000;
              return (
                <View key={p.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: i === scanning.length - 1 ? 0 : 1, borderBottomColor: c.rule }}>
                  <Avatar name={p.fullName} size={34} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodySmStrong">{p.fullName}</Txt>
                    <Txt variant="caption" tone="muted">
                      {recent ? 'Scanning now' : `Last seen ${minutesAgo(p.lastSeenAt)}`}
                    </Txt>
                  </View>
                  {recent ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.found }} /> : null}
                </View>
              );
            })
          )}
          {a.assignees.length ? (
            <Txt variant="caption" tone="muted">{`${a.assignees.length} ${a.assignees.length === 1 ? 'person' : 'people'} on this yard plan`}</Txt>
          ) : null}
          <View style={{ height: 10 }} />
          <SectionTitle title="Shifts" />
          <PlanShifts plan={a} open={live} />
        </Column>
      </Columns>

      {Platform.OS === 'web' ? (
        <View style={{ gap: 14 }}>
          <SectionTitle title="Site map" aside={live ? 'Updates live' : undefined} />
          <SiteMap auditId={a.id} live={live} />
        </View>
      ) : null}

      <View style={{ gap: 14 }}>
        <SectionTitle title="Latest scans" aside={live ? 'Updates live' : undefined} />
        <DataTable
          label="Latest scans"
          columns={scanColumns}
          rows={(scans.data?.pages[0]?.items ?? []).slice(0, 12)}
          rowKey={(s) => s.id}
          attention={(s) => s.flags.length > 0 && s.reviewStatus === 'PENDING'}
          loading={scans.isPending}
          error={scans.error as Error | null}
          empty={{ icon: 'scan', title: 'No scans yet', body: 'They show up here the moment the clerks scan.' }}
          onRowPress={(s) => (s.flags.length ? router.push(`/dashboard/review?scan=${s.id}` as never) : undefined)}
        />
      </View>

      <ResultLists auditId={a.id} counts={k} place={place} onClearPlace={() => setPlace(null)} />
    </Page>
  );
}

/** The plan's shifts, soonest first, each opening on the shift page. */
function PlanShifts({ plan, open }: { plan: AuditDto; open: boolean }) {
  const { c } = useTheme();
  const shifts = plan.shifts ?? [];
  const today = dayKey(Date.now());
  const add = () => router.push(`/dashboard/shifts?shift=new&plan=${plan.id}` as never);
  if (!shifts.length) {
    return open ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        <Txt variant="bodySm" tone="muted">
          No shifts yet.
        </Txt>
        <Button label="Plan one" variant="quiet" onPress={add} />
      </View>
    ) : (
      <Txt variant="bodySm" tone="muted">
        No shifts were planned.
      </Txt>
    );
  }
  return (
    <View>
      {shifts.map((s, i) => {
        const past = dayKey(s.endsAt) < today;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="link"
            accessibilityLabel={`${s.name}, ${dayWord(dayKey(s.startsAt))}, ${eatTime(s.startsAt)} to ${eatTime(s.endsAt)}`}
            onPress={() => router.push(`/dashboard/shifts?shift=${s.id}&plan=${plan.id}${past ? '&view=past' : ''}` as never)}
            style={(st) => ({
              gap: 2,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.rule,
              backgroundColor: (st as { hovered?: boolean }).hovered ? c.hover : 'transparent',
              opacity: st.pressed ? 0.7 : 1,
            })}
          >
            <Txt variant="bodySmStrong">{s.name}</Txt>
            <Txt variant="caption" tone="muted">
              {`${dayWord(dayKey(s.startsAt))}, `}
              <Txt variant="monoSm" tone="muted">{`${eatTime(s.startsAt)} to ${eatTime(s.endsAt)}`}</Txt>
              {`, ${s.clerkIds.length} ${s.clerkIds.length === 1 ? 'clerk' : 'clerks'}`}
            </Txt>
          </Pressable>
        );
      })}
      {open ? <Button label="Add a shift" variant="quiet" onPress={add} style={{ marginTop: 4, marginLeft: -12 }} /> : null}
    </View>
  );
}

function ResultLists({
  auditId,
  counts,
  place,
  onClearPlace,
}: {
  auditId: string;
  counts: { found: number; missing: number; unexpected: number; mismatched: number };
  place: string | null;
  onClearPlace: () => void;
}) {
  const [bucket, setBucket] = useState<Bucket>('missing');
  const [q, setQ] = useState('');
  const res = useResults(auditId, bucket);
  const rows = useMemo(() => {
    const all = res.data?.pages.flatMap((p) => p.items) ?? [];
    const needle = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return all.filter((r) => {
      if (needle && !r.containerNumber.includes(needle)) return false;
      if (place) {
        const loc = splitLocation(r.location);
        if (!loc) return false;
        const key = place.includes('-') ? `${loc.row}-${loc.bay}` : loc.row;
        if (key !== place) return false;
      }
      return true;
    });
  }, [res.data, q, place]);

  return (
    <View style={{ gap: 14 }}>
      <SectionTitle title="Results" aside={place ? `Showing ${place}` : undefined} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <FilterPills<Bucket>
          label="Bucket"
          value={bucket}
          onChange={setBucket}
          options={[
            { id: 'missing', label: 'Missing', count: counts.missing },
            { id: 'found', label: 'Found', count: counts.found },
            { id: 'unexpected', label: 'Unexpected', count: counts.unexpected },
            { id: 'mismatched', label: 'Needs review', count: counts.mismatched },
          ]}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexGrow: 0, flexBasis: 280, flexShrink: 1 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Search" value={q} onChangeText={setQ} placeholder="Container number" mono />
          </View>
          {place ? <Button label="Clear bay" variant="quiet" onPress={onClearPlace} /> : null}
        </View>
      </View>
      <DataTable
        label="Results"
        columns={resultColumns}
        rows={rows}
        rowKey={(r) => `${r.bucket}-${r.containerNumber}-${r.scanId ?? r.expectedContainerId ?? ''}`}
        loading={res.isPending}
        error={res.error as Error | null}
        empty={{ icon: 'check-circle', title: 'Nothing here', body: q || place ? 'Nothing matches that search.' : 'No containers in this bucket.' }}
        onMore={res.hasNextPage ? () => void res.fetchNextPage() : undefined}
        loadingMore={res.isFetchingNextPage}
      />
    </View>
  );
}
