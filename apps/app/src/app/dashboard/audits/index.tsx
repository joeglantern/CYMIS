import type { AuditDto, AuditStatus as Status } from '@cymis/schemas';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAudits } from '@/api/queries';
import { AuditStatus, openAudit } from '@/features/dash/AuditRows';
import { DataTable, MonoCell, TextCell, type Column } from '@/features/dash/DataTable';
import { barProps, day } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { Avatar, BucketBar, Button, FilterPills, Txt, fmt } from '@/ui';

type Filter = Status | 'ALL';

export default function Audits() {
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const all = useAudits({});
  const items = all.data?.items ?? [];
  const count = (s: Status) => items.filter((a) => a.status === s).length;
  const rows = filter === 'ALL' ? items : items.filter((a) => a.status === filter);

  const columns: Column<AuditDto>[] = [
    {
      key: 'name',
      label: 'Audit',
      flex: 1.6,
      render: (a) => (
        <View style={{ gap: 2, minWidth: 0 }}>
          <TextCell strong>{a.name}</TextCell>
          <TextCell muted>{`${a.section.name}, ${a.section.facility.code}`}</TextCell>
        </View>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      flex: 1.4,
      render: (a) => (
        <View style={{ gap: 6, width: '100%' }}>
          <BucketBar {...barProps(a.counts, a.status === 'ACTIVE')} legend={false} height={8} />
          <MonoCell muted>{`${fmt(a.counts.found)} of ${fmt(a.counts.expected)} found`}</MonoCell>
        </View>
      ),
    },
    {
      key: 'crew',
      label: 'Crew',
      width: 120,
      render: (a) =>
        a.assignees.length ? (
          <View style={{ flexDirection: 'row' }}>
            {a.assignees.slice(0, 4).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i ? -6 : 0 }}>
                <Avatar name={p.fullName} size={26} />
              </View>
            ))}
            {a.assignees.length > 4 ? (
              <Txt variant="caption" tone="muted" style={{ marginLeft: 6, alignSelf: 'center' }}>
                {`+${a.assignees.length - 4}`}
              </Txt>
            ) : null}
          </View>
        ) : (
          <TextCell muted>Nobody yet</TextCell>
        ),
    },
    { key: 'when', label: 'Started', width: 130, render: (a) => <MonoCell muted>{day(a.startedAt ?? a.createdAt)}</MonoCell> },
    { key: 'status', label: 'Status', width: 120, render: (a) => <AuditStatus status={a.status} /> },
  ];

  return (
    <Page gap={22}>
      <PageHeader
        title="Audits"
        subtitle="Every count, live or finished."
        actions={<Button label="New audit" icon="plus" onPress={() => router.push('/dashboard/audits/new' as never)} />}
      />
      <FilterPills<Filter>
        label="Filter by status"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'ACTIVE', label: 'Live', count: count('ACTIVE') },
          { id: 'DRAFT', label: 'Draft', count: count('DRAFT') },
          { id: 'CLOSED', label: 'Closed', count: count('CLOSED') },
          { id: 'CANCELLED', label: 'Cancelled', count: count('CANCELLED') },
          { id: 'ALL', label: 'All', count: items.length },
        ]}
      />
      <DataTable
        label="Audits"
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        onRowPress={openAudit}
        loading={all.isPending}
        error={all.error as Error | null}
        empty={{
          icon: 'list-checks',
          title: filter === 'ACTIVE' ? 'Nothing live right now' : 'No audits here',
          body: filter === 'DRAFT' ? 'Drafts are audits you started setting up but did not start.' : 'Start a new audit from a terminal export.',
        }}
      />
    </Page>
  );
}
