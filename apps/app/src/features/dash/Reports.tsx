import type { ReportDto, ReportFormat } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, useReports } from '@/api/queries';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Button, Icon, Sheet, Txt, useToast, type IconName } from '@/ui';
import { dayTime } from './format';

export const formats: { id: ReportFormat; label: string; detail: string; icon: IconName }[] = [
  { id: 'XLSX', label: 'Excel workbook', detail: 'A sheet for each bucket, ready to filter', icon: 'file-xls' },
  { id: 'PDF', label: 'PDF summary', detail: 'One page to print or send', icon: 'file-pdf' },
  { id: 'CSV', label: 'CSV file', detail: 'Plain rows for other systems', icon: 'file-csv' },
];

export function useCreateReport(auditId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (format: ReportFormat) => endpoints.createReport(auditId, format),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.reports(auditId) });
      toast({ text: 'Making the report. It shows up below when ready.' });
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
}

export async function openReport(r: ReportDto) {
  // Links expire after a few minutes, so fetch a fresh one each time.
  const fresh = await endpoints.report(r.id);
  if (fresh.downloadUrl) {
    feedback.tap();
    await Linking.openURL(fresh.downloadUrl);
  }
}

/** One past report: format, when, and a download button once ready. */
export function ReportLine({ report, last }: { report: ReportDto; last?: boolean }) {
  const { c } = useTheme();
  const toast = useToast();
  const f = formats.find((x) => x.id === report.format);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.rule }}>
      <Icon name={f?.icon ?? 'file-xls'} size={22} color={c.ink2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodySmStrong">{f?.label ?? report.format}</Txt>
        <Txt variant="caption" tone={report.status === 'FAILED' ? 'dangerText' : 'muted'}>
          {report.status === 'FAILED' ? (report.failureReason ?? 'Could not be made') : dayTime(report.readyAt ?? report.createdAt)}
        </Txt>
      </View>
      {report.status === 'READY' ? (
        <Button
          label="Download"
          icon="download-simple"
          variant="secondary"
          onPress={() => openReport(report).catch((e) => toast({ text: (e as Error).message, tone: 'error' }))}
        />
      ) : report.status === 'FAILED' ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={c.muted} />
          <Txt variant="caption" tone="muted">
            Making it
          </Txt>
        </View>
      )}
    </View>
  );
}

/** Format choices plus the reports already made for this audit. */
export function ReportPanel({ auditId }: { auditId: string }) {
  const { c } = useTheme();
  const reports = useReports(auditId);
  const create = useCreateReport(auditId);
  const list = [...(reports.data ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {formats.map((f) => (
          <View key={f.id} style={{ flexGrow: 1, flexBasis: 200, gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.raised }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={f.icon} size={22} />
              <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
                {f.label}
              </Txt>
            </View>
            <Txt variant="caption" tone="muted">
              {f.detail}
            </Txt>
            <Button label="Make it" variant="secondary" loading={create.isPending && create.variables === f.id} onPress={() => create.mutate(f.id)} />
          </View>
        ))}
      </View>
      {list.length ? (
        <View>
          {list.map((r, i) => (
            <ReportLine key={r.id} report={r} last={i === list.length - 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Button that opens the report panel in a sheet. */
export function ReportButton({ auditId }: { auditId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Download report" icon="download-simple" variant="secondary" onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} label="Download report" width={620}>
        <Txt variant="heading">Download report</Txt>
        <ReportPanel auditId={auditId} />
      </Sheet>
    </>
  );
}
