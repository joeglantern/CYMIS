import type { ActivityDto } from '@cymis/schemas';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { AdminOnly } from '@/features/dash/AdminOnly';
import { DataTable, MonoCell, TextCell, type Column } from '@/features/dash/DataTable';
import { dayTime } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { FilterPills } from '@/ui';

type Kind = 'all' | 'section' | 'user' | 'audit' | 'import' | 'scan' | 'service_account';

/** "audit.closed" becomes "Audit closed". */
function words(action: string) {
  const s = action.replace(/[._]/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Activity() {
  return (
    <AdminOnly>
      <ActivityPage />
    </AdminOnly>
  );
}

function ActivityPage() {
  const [kind, setKind] = useState<Kind>('all');
  const filter = kind === 'all' ? {} : { entityType: kind };
  const q = useInfiniteQuery({
    queryKey: keys.activity(filter),
    queryFn: ({ pageParam }) => endpoints.activity({ ...filter, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const columns: Column<ActivityDto>[] = [
    { key: 'when', label: 'When', width: 150, render: (a) => <MonoCell muted>{dayTime(a.createdAt)}</MonoCell> },
    {
      key: 'who',
      label: 'Who',
      flex: 1,
      render: (a) => (
        <View>
          <TextCell strong>{a.actor?.fullName ?? 'System'}</TextCell>
          {a.actor ? <MonoCell muted>{a.actor.staffId}</MonoCell> : null}
        </View>
      ),
    },
    { key: 'what', label: 'What', flex: 1.4, render: (a) => <TextCell>{words(a.action)}</TextCell> },
    { key: 'on', label: 'On', flex: 1, render: (a) => <MonoCell muted>{a.entityId ? `${a.entityType} ${a.entityId.slice(0, 8)}` : a.entityType}</MonoCell> },
    { key: 'ip', label: 'From', width: 140, render: (a) => <MonoCell muted>{a.ip ?? ''}</MonoCell> },
  ];

  return (
    <Page gap={22}>
      <PageHeader title="Activity log" subtitle="Sign ins, imports, reviews, closes and changes to people. Kept for audits of the audit." />
      <FilterPills<Kind>
        label="Filter by kind"
        value={kind}
        onChange={setKind}
        options={[
          { id: 'all', label: 'Everything' },
          { id: 'section', label: 'Sections' },
          { id: 'user', label: 'People and sign ins' },
          { id: 'audit', label: 'Audits' },
          { id: 'import', label: 'Imports' },
          { id: 'scan', label: 'Reviews' },
          { id: 'service_account', label: 'Keys' },
        ]}
      />
      <DataTable
        label="Activity"
        columns={columns}
        rows={q.data?.pages.flatMap((p) => p.items) ?? []}
        rowKey={(a) => a.id}
        loading={q.isPending}
        error={q.error as Error | null}
        empty={{ icon: 'scroll', title: 'Nothing logged', body: 'Actions show up here as people use the app.' }}
        onMore={q.hasNextPage ? () => void q.fetchNextPage() : undefined}
        loadingMore={q.isFetchingNextPage}
        minWidth={820}
      />
    </Page>
  );
}
