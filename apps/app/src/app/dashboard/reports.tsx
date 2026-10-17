import { useState } from 'react';
import { View } from 'react-native';
import { useAudits } from '@/api/queries';
import { AuditStatus } from '@/features/dash/AuditRows';
import { day } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { ReportPanel } from '@/features/dash/Reports';
import { Select } from '@/features/dash/Select';
import { EmptyState, SectionTitle, Skeleton, Txt, fmt } from '@/ui';

export default function Reports() {
  const audits = useAudits({});
  const list = (audits.data?.items ?? []).filter((a) => a.status === 'ACTIVE' || a.status === 'CLOSED');
  const [id, setId] = useState<string | null>(null);
  const picked = list.find((a) => a.id === id) ?? list[0];

  return (
    <Page gap={24} maxWidth={900}>
      <PageHeader title="Reports" subtitle="Make a report for any live or closed audit. Live reports show the count so far." />
      {audits.isPending ? (
        <Skeleton height={44} />
      ) : list.length === 0 ? (
        <EmptyState icon="file-pdf" title="No audits to report on" body="Reports are made from live or closed audits." />
      ) : (
        <>
          <Select
            label="Audit"
            value={picked?.id}
            onChange={(v) => setId(v)}
            options={list.map((a) => ({ value: a.id, label: a.name, detail: `${a.section.name}, ${a.status === 'ACTIVE' ? 'live' : `closed ${day(a.closedAt).toLowerCase()}`}` }))}
          />
          {picked ? (
            <View style={{ gap: 16 }}>
              <SectionTitle title={picked.name} aside={<AuditStatus status={picked.status} />} />
              <Txt variant="bodySm" tone="muted">
                {`${fmt(picked.counts.found)} found, ${fmt(picked.counts.missing)} missing, ${fmt(picked.counts.unexpected)} unexpected, ${fmt(picked.counts.mismatched)} needing review.`}
              </Txt>
              <ReportPanel key={picked.id} auditId={picked.id} />
            </View>
          ) : null}
        </>
      )}
    </Page>
  );
}
