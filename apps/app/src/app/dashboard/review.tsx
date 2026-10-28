import { isValidContainerNumber, formatContainerNumber } from '@cymis/iso6346';
import type { ReviewScanBody, ScanDto } from '@cymis/schemas';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { useAudits } from '@/api/queries';
import { feedback } from '@/feedback';
import { DataTable } from '@/features/dash/DataTable';
import { dayTime, flagWords } from '@/features/dash/format';
import { scanColumns } from '@/features/dash/scanColumns';
import { useLayout, useTheme } from '@/theme/theme';
import { floatShadow, fonts, radius } from '@/theme/tokens';
import { Button, ContainerNumber, FilterPills, IconButton, Skeleton, TextField, Txt, useToast } from '@/ui';

type Reason = 'all' | 'number' | 'colour' | 'check';
const reasonFlag: Record<Exclude<Reason, 'all'>, string> = { number: 'NUMBER_MISMATCH', colour: 'COLOUR_MISMATCH', check: 'CHECK_DIGIT_FAILED' };

export default function Review() {
  const params = useLocalSearchParams<{ scan?: string }>();
  const { c, dark } = useTheme();
  const { width } = useLayout();
  const qc = useQueryClient();
  const toast = useToast();
  const active = useAudits({ status: 'ACTIVE' });
  const audits = active.data?.items ?? [];
  const lists = useQueries({
    queries: audits.map((a) => ({
      queryKey: ['scans', a.id, { review: true }],
      queryFn: () => endpoints.scans(a.id, { flagged: true, reviewStatus: 'PENDING', limit: 200 }),
      refetchInterval: 30_000,
    })),
  });
  const loading = active.isPending || lists.some((l) => l.isPending);
  const all = useMemo(
    () => lists.flatMap((l) => l.data?.items ?? []).sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lists.map((l) => l.dataUpdatedAt).join(',')],
  );

  const [reason, setReason] = useState<Reason>('all');
  const rows = reason === 'all' ? all : all.filter((s) => s.flags.includes(reasonFlag[reason] as ScanDto['flags'][number]));
  const count = (r: Exclude<Reason, 'all'>) => all.filter((s) => s.flags.includes(reasonFlag[r] as ScanDto['flags'][number])).length;

  // '' means the panel was closed on purpose; null means pick the first row.
  const [selectedId, setSelectedId] = useState<string | null>(params.scan ?? null);
  const selected = selectedId === '' ? null : (rows.find((s) => s.id === selectedId) ?? rows[0] ?? null);

  const auditName = (id: string) => audits.find((a) => a.id === id)?.name ?? '';

  const decide = useMutation({
    mutationFn: ({ scan, body }: { scan: ScanDto; body: ReviewScanBody }) => endpoints.reviewScan(scan.id, body),
    onSuccess: (_res, { scan, body }) => {
      feedback.success();
      const idx = rows.findIndex((s) => s.id === scan.id);
      const next = rows[idx + 1] ?? rows[idx - 1] ?? null;
      setSelectedId(next?.id ?? null);
      void qc.invalidateQueries({ queryKey: ['scans', scan.auditId] });
      void qc.invalidateQueries({ queryKey: ['audits'] });
      const words = body.action === 'APPROVE' ? 'Kept as read' : body.action === 'CORRECT' ? 'Corrected' : 'Rejected';
      toast({ text: `${words}: ${pretty(body.correctedNumber ?? scan.containerNumber)}`, tone: 'success' });
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const stacked = width < 1100;
  const pad = width < 700 ? 16 : 32;
  const list = (
    <View style={{ padding: pad, paddingTop: 28, gap: 22 }}>
        <View style={{ gap: 4 }}>
        <Txt variant={width < 700 ? 'title' : 'titleLg'} accessibilityRole="header">
          Review queue
        </Txt>
        <Txt variant="bodySm" tone="muted">
          {loading ? 'Loading...' : all.length ? `${all.length} ${all.length === 1 ? 'scan needs' : 'scans need'} a decision before the reports are final.` : 'Nothing waiting.'}
        </Txt>
      </View>
      <FilterPills<Reason>
        label="Filter by reason"
        value={reason}
        onChange={setReason}
        options={[
          { id: 'all', label: 'All', count: all.length },
          { id: 'number', label: 'Number differs', count: count('number') },
          { id: 'colour', label: 'Colour differs', count: count('colour') },
          { id: 'check', label: 'Check digit', count: count('check') },
        ]}
      />
      <DataTable
        label="Scans to review"
        columns={scanColumns}
        rows={rows}
        rowKey={(s) => s.id}
        selectedKey={selected?.id ?? null}
        onRowPress={(s) => {
          feedback.select();
          setSelectedId(s.id);
        }}
        loading={loading}
        error={(active.error as Error | null) ?? null}
        empty={{ icon: 'check-circle', title: 'All clear', body: 'Flagged scans from live audits show up here. Nothing needs you right now.' }}
      />
      {Platform.OS === 'web' && width >= 1000 && rows.length ? (
        <Txt variant="caption" tone="muted">
          Keys: J and K move, A keeps as read, C corrects, R rejects.
        </Txt>
      ) : null}
    </View>
  );

  const panel = selected ? (
        <View
          style={{
            width: stacked ? '100%' : 420,
            borderLeftWidth: stacked ? 0 : 1,
            borderTopWidth: stacked ? 1 : 0,
            borderColor: c.rule,
            backgroundColor: c.raised,
            ...(stacked ? {} : floatShadow(dark)),
          }}
        >
          <Detail
            scroll={!stacked}
            key={selected.id}
            scan={selected}
            auditName={auditName(selected.auditId)}
            busy={decide.isPending}
            onDecide={(body) => decide.mutate({ scan: selected, body })}
            onClose={() => setSelectedId('')}
            onMove={(d) => {
              const i = rows.findIndex((s) => s.id === selected.id);
              const n = rows[i + d];
              if (n) {
                feedback.select();
                setSelectedId(n.id);
              }
            }}
          />
        </View>
      ) : null;

  if (stacked)
    return (
      <ScrollView style={{ flex: 1 }}>
        {list}
        {panel}
      </ScrollView>
    );

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <ScrollView style={{ flex: 1 }}>{list}</ScrollView>
      {panel}
    </View>
  );
}

const pretty = (n: string) => (n.length === 11 ? formatContainerNumber(n) : n);

function Detail({
  scroll,
  scan,
  auditName,
  busy,
  onDecide,
  onClose,
  onMove,
}: {
  scroll: boolean;
  scan: ScanDto;
  auditName: string;
  busy: boolean;
  onDecide: (b: ReviewScanBody) => void;
  onClose: () => void;
  onMove: (d: 1 | -1) => void;
}) {
  const { c } = useTheme();
  const toast = useToast();
  const [note, setNote] = useState(scan.reviewNote ?? '');
  const photo = scan.photos.find((p) => p.status === 'UPLOADED');
  const url = useQuery({ queryKey: ['photo', photo?.id], queryFn: () => endpoints.photoUrl(photo!.id), enabled: !!photo, staleTime: 4 * 60_000 });
  const second = scan.serverOcrNumber;
  const secondOk = !!second && isValidContainerNumber(second);
  const canCorrect = secondOk && second !== scan.containerNumber;
  const colourFix = scan.flags.includes('COLOUR_MISMATCH') && scan.colourSuggested ? scan.colourSuggested : null;
  const title = scan.flags.includes('NUMBER_MISMATCH') ? 'Number differs' : scan.flags.includes('CHECK_DIGIT_FAILED') ? 'Check digit fails' : scan.flags.includes('COLOUR_MISMATCH') ? 'Colour differs' : 'Needs a look';

  const reject = () => {
    if (!note.trim()) {
      toast({ text: 'Say why in the note before rejecting.', tone: 'warning' });
      return;
    }
    onDecide({ action: 'REJECT', note: note.trim() });
  };
  const correct = () => {
    if (canCorrect) onDecide({ action: 'CORRECT', correctedNumber: second!, ...(note.trim() ? { note: note.trim() } : {}) });
    else if (colourFix) onDecide({ action: 'CORRECT', correctedColour: colourFix, ...(note.trim() ? { note: note.trim() } : {}) });
  };
  const approve = () => onDecide({ action: 'APPROVE', ...(note.trim() ? { note: note.trim() } : {}) });

  // Keyboard shortcuts on the web. Ignored while typing in a field.
  const handlers = useRef({ approve, correct, reject, onMove });
  handlers.current = { approve, correct, reject, onMove };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'j') handlers.current.onMove(1);
      else if (k === 'k') handlers.current.onMove(-1);
      else if (k === 'a') handlers.current.approve();
      else if (k === 'c') handlers.current.correct();
      else if (k === 'r') handlers.current.reject();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const body = (
    <View style={{ padding: 24, gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 8, flexShrink: 1 }}>
          <Txt variant="label" tone="muted" caps>
            {title}
          </Txt>
          <ContainerNumber value={scan.containerNumber} size="lg" state={scan.checkDigitValid ? 'valid' : 'invalid'} />
        </View>
        <IconButton icon="x" label="Close details" onPress={onClose} size={40} />
      </View>

      {photo ? (
        url.data ? (
          <Image
            // The link changes every few minutes but the photo never does, so cache it by its id.
            source={{ uri: url.data.url, cacheKey: `photo-${photo.id}` }}
            cachePolicy="memory-disk"
            transition={{ duration: 160, effect: 'cross-dissolve' }}
            accessibilityLabel={`Photo of the container door taken by ${scan.auditor.fullName}`}
            contentFit="cover"
            style={{ width: '100%', height: 200, borderRadius: radius.md, backgroundColor: c.paper2 }}
          />
        ) : (
          <Skeleton height={200} radius={radius.md} />
        )
      ) : (
        <View style={{ height: 80, borderRadius: radius.md, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="caption" tone="muted">
            {scan.photos.length ? 'Photo still uploading from the phone' : 'No photo with this scan'}
          </Txt>
        </View>
      )}

      <View style={{ gap: 12 }}>
        <Fact label="Phone read">
          <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 14 }}>{pretty(scan.containerNumber)}</Txt>
          {!scan.checkDigitValid ? <Txt variant="bodySm" tone="dangerText">Check digit fails</Txt> : null}
          <Txt variant="caption" tone="muted">
            {scan.entryMethod === 'MANUAL' ? 'Typed in' : scan.entryMethod === 'OCR_CORRECTED' ? 'Read, then fixed by hand' : `Read by the camera${scan.ocrConfidence ? `, ${Math.round(scan.ocrConfidence * 100)} percent sure` : ''}`}
          </Txt>
        </Fact>
        <Fact label="Second read">
          {second ? (
            <>
              <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 14 }}>{pretty(second)}</Txt>
              <Txt variant="bodySm" color={secondOk ? c.found : c.dangerText}>
                {secondOk ? `Passes${scan.serverOcrConfidence ? `, ${Math.round(scan.serverOcrConfidence * 100)} percent sure` : ''}` : 'Also fails the check digit'}
              </Txt>
            </>
          ) : (
            <Txt variant="bodySm" tone="muted">
              {scan.cvStatus === 'PENDING' ? 'Still checking the photo' : 'Not available'}
            </Txt>
          )}
        </Fact>
        {scan.flags.includes('COLOUR_MISMATCH') ? (
          <Fact label="Colour">
            <Txt variant="bodySm">{`Crew picked ${scan.colourChosen ?? 'nothing'}, photo looks ${scan.colourSuggested ?? 'unclear'}`}</Txt>
          </Fact>
        ) : null}
        <Fact label="On the list">
          <Txt variant="bodySm">{scan.result === 'MATCHED' ? 'Yes' : scan.result === 'UNEXPECTED' ? 'No, not on the list' : 'Scanned twice'}</Txt>
        </Fact>
        <Fact label="Scanned by">
          <Txt variant="bodySm">{`${scan.auditor.fullName}, ${dayTime(scan.capturedAt)}`}</Txt>
          <Txt variant="caption" tone="muted">
            {auditName}
            {scan.location?.accuracyM ? `, location within ${Math.round(scan.location.accuracyM)} m` : ''}
          </Txt>
        </Fact>
        <Fact label="Flags">
          <Txt variant="bodySm">{scan.flags.map((f) => flagWords[f] ?? f).join(', ')}</Txt>
        </Fact>
      </View>

      <TextField label="Note" placeholder="Needed if you reject the scan" value={note} onChangeText={setNote} maxLength={500} />

      <View style={{ gap: 8 }}>
        {canCorrect ? (
          <Button label={`Correct to ${pretty(second!)}`} icon="check" size="lg" block loading={busy} onPress={correct} />
        ) : colourFix ? (
          <Button label={`Correct colour to ${colourFix}`} icon="check" size="lg" block loading={busy} onPress={correct} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="Keep as read" variant={canCorrect || colourFix ? 'secondary' : 'primary'} block size="lg" disabled={busy} onPress={approve} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Reject" variant="danger-quiet" block size="lg" disabled={busy} onPress={reject} />
          </View>
        </View>
      </View>
    </View>
  );
  return scroll ? <ScrollView>{body}</ScrollView> : body;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <Txt variant="bodySm" tone="muted" style={{ width: 96 }}>
        {label}
      </Txt>
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
    </View>
  );
}
