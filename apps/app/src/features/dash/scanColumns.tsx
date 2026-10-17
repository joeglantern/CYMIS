import type { ResultRow, ScanDto } from '@cymis/schemas';
import { View } from 'react-native';
import { ContainerNumber, StatusChip, Txt, type BucketKey } from '@/ui';
import { scanBucket } from './AuditRows';
import type { Column } from './DataTable';
import { MonoCell, TextCell } from './DataTable';
import { flagWords, time } from './format';

const colourDot: Record<string, string> = {
  blue: '#2d4bb9',
  red: '#b3261e',
  maroon: '#6d1a24',
  green: '#2f6b45',
  grey: '#8f8d88',
  white: '#f4f3ef',
  orange: '#d9731e',
  yellow: '#f6e61e',
  brown: '#6b4a2b',
  black: '#1b1b1a',
};

export function ColourCell({ name }: { name: string | null | undefined }) {
  if (!name) return <TextCell muted>Not set</TextCell>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colourDot[name] ?? '#999', borderWidth: 1, borderColor: 'rgba(14,14,14,0.18)' }} />
      <TextCell>{name[0]!.toUpperCase() + name.slice(1)}</TextCell>
    </View>
  );
}

export const scanColumns: Column<ScanDto>[] = [
  {
    key: 'number',
    label: 'Container',
    width: 190,
    render: (s) => <ContainerNumber value={s.containerNumber} size="sm" state={s.checkDigitValid ? 'valid' : 'invalid'} />,
  },
  { key: 'status', label: 'Status', width: 150, render: (s) => <StatusChip bucket={scanBucket(s)} size="sm" /> },
  {
    key: 'flags',
    label: 'Why',
    flex: 1,
    render: (s) => <TextCell muted>{s.flags.map((f) => flagWords[f] ?? f).join(', ') || (s.result === 'DUPLICATE' ? 'Already scanned' : '')}</TextCell>,
  },
  { key: 'colour', label: 'Colour', width: 110, render: (s) => <ColourCell name={s.colourChosen ?? s.colourSuggested} /> },
  { key: 'by', label: 'Scanned by', flex: 1, render: (s) => <TextCell>{s.auditor.fullName}</TextCell> },
  { key: 'time', label: 'Time', width: 70, align: 'right', render: (s) => <MonoCell>{time(s.capturedAt)}</MonoCell> },
];

const resultBucket: Record<ResultRow['bucket'], BucketKey> = { found: 'found', missing: 'missing', unexpected: 'unexpected', mismatched: 'review' };

export const resultColumns: Column<ResultRow>[] = [
  { key: 'number', label: 'Container', width: 190, render: (r) => <ContainerNumber value={r.containerNumber} size="sm" /> },
  { key: 'bucket', label: 'Status', width: 150, render: (r) => <StatusChip bucket={resultBucket[r.bucket]} size="sm" /> },
  { key: 'location', label: 'Location', width: 120, render: (r) => <MonoCell>{r.location ?? ''}</MonoCell> },
  { key: 'colour', label: 'Colour', width: 110, render: (r) => <ColourCell name={r.colour} /> },
  { key: 'by', label: 'Scanned by', flex: 1, render: (r) => <TextCell muted={!r.scannedBy}>{r.scannedBy ?? 'Not scanned'}</TextCell> },
  {
    key: 'flags',
    label: 'Why',
    flex: 1,
    render: (r) => (
      <Txt variant="bodySm" tone="muted" numberOfLines={1}>
        {r.flags.map((f) => flagWords[f] ?? f).join(', ')}
      </Txt>
    ),
  },
  { key: 'time', label: 'Time', width: 70, align: 'right', render: (r) => <MonoCell>{time(r.scannedAt)}</MonoCell> },
];
