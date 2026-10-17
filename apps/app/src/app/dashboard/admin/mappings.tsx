import { IMPORT_FIELDS, type ColumnMappingDto } from '@cymis/schemas';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { AdminOnly } from '@/features/dash/AdminOnly';
import { day } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { EmptyState, Skeleton, Txt } from '@/ui';

const words: Record<(typeof IMPORT_FIELDS)[number], string> = {
  containerNumber: 'Container number',
  sizeType: 'Size and type',
  location: 'Yard location',
  vessel: 'Vessel',
  voyage: 'Voyage',
  fullEmpty: 'Full or empty',
  lineOperator: 'Line operator',
  category: 'Category',
};

export default function Mappings() {
  return (
    <AdminOnly>
      <MappingsPage />
    </AdminOnly>
  );
}

function MappingsPage() {
  const q = useQuery({ queryKey: keys.mappings(), queryFn: endpoints.columnMappings });
  return (
    <Page gap={22} maxWidth={980}>
      <PageHeader title="Column mappings" subtitle="Saved when someone imports a file and names their column choices. A file with the same columns picks one up by itself." />
      {q.isPending ? (
        <Skeleton height={140} radius={14} />
      ) : q.isError ? (
        <EmptyState icon="warning-circle" title="Could not load mappings" body={(q.error as Error).message} />
      ) : !q.data.length ? (
        <EmptyState icon="columns" title="None saved yet" body="When you set up an audit, give your column choices a name and they show up here." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {q.data.map((m) => (
            <MappingCard key={m.id} m={m} />
          ))}
        </View>
      )}
    </Page>
  );
}

function MappingCard({ m }: { m: ColumnMappingDto }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 300, gap: 12, padding: 18, borderRadius: radius.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.raised }}>
      <View style={{ gap: 2 }}>
        <Txt variant="bodyStrong">{m.name}</Txt>
        <Txt variant="caption" tone="muted">{`Saved ${day(m.createdAt).toLowerCase()}`}</Txt>
      </View>
      <View style={{ gap: 6 }}>
        {IMPORT_FIELDS.filter((f) => m.mapping[f]).map((f) => (
          <View key={f} style={{ flexDirection: 'row', gap: 10 }}>
            <Txt variant="caption" tone="muted" style={{ width: 120 }}>
              {words[f]}
            </Txt>
            <Txt style={{ flex: 1, fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
              {m.mapping[f]}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}
