import type { Bucket, ResultRow } from '@cymis/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { endpoints } from '@/api/endpoints';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { EmptyState, Skeleton, Txt, bucketColours } from '@/ui';

const BUCKETS: Bucket[] = ['found', 'missing', 'unexpected', 'mismatched'];
const CAP = 3000;

/** Every result row for an audit, all buckets, up to a cap. Enough to draw the map. */
export function useAllResults(auditId: string, live: boolean) {
  return useQuery({
    queryKey: ['results-all', auditId],
    queryFn: async () => {
      const out: ResultRow[] = [];
      for (const b of BUCKETS) {
        let cursor: string | undefined;
        do {
          const page = await endpoints.results(auditId, b, cursor, 200);
          out.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor && out.length < CAP);
      }
      return out;
    },
    refetchInterval: live ? 45_000 : false,
  });
}

type CellState = 'found' | 'missing' | 'review' | 'unexpected' | 'open';

interface Bay {
  key: string;
  bay: string;
  state: CellState;
  counts: Record<Bucket, number>;
}

/** Splits a location like A01-02-3 into a row (A01) and a bay (02). */
export function splitLocation(loc: string | null): { row: string; bay: string } | null {
  if (!loc) return null;
  const parts = loc.trim().toUpperCase().split(/[\s\-/.]+/).filter(Boolean);
  if (!parts.length) return null;
  return { row: parts[0]!, bay: parts[1] ?? '1' };
}

function cellState(k: Record<Bucket, number>, live: boolean): CellState {
  if (k.mismatched > 0) return 'review';
  if (k.missing > 0) return live ? 'open' : 'missing';
  if (k.unexpected > 0) return 'unexpected';
  return 'found';
}

const words: Record<CellState, string> = {
  found: 'all found',
  missing: 'boxes missing',
  review: 'needs review',
  unexpected: 'unexpected box',
  open: 'not all scanned yet',
};

/**
 * One square per bay, coloured by what is in it. Rows are the first part of
 * the location code. Tap a bay to filter the lists below to it.
 */
export function YardMap({
  rows,
  loading,
  live,
  selected,
  onSelect,
}: {
  rows: ResultRow[] | undefined;
  loading: boolean;
  live: boolean;
  selected: string | null;
  onSelect: (prefix: string | null) => void;
}) {
  const { c } = useTheme();

  const grid = useMemo(() => {
    const byRow = new Map<string, Map<string, Record<Bucket, number>>>();
    let located = 0;
    for (const r of rows ?? []) {
      const loc = splitLocation(r.location);
      if (!loc) continue;
      located++;
      const bays = byRow.get(loc.row) ?? new Map<string, Record<Bucket, number>>();
      const k = bays.get(loc.bay) ?? { found: 0, missing: 0, unexpected: 0, mismatched: 0 };
      k[r.bucket]++;
      bays.set(loc.bay, k);
      byRow.set(loc.row, bays);
    }
    const total = rows?.length ?? 0;
    const list = [...byRow.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
      .slice(0, 40)
      .map(([row, bays]) => ({
        row,
        bays: [...bays.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
          .map(([bay, counts]): Bay => ({ key: `${row}-${bay}`, bay, counts, state: cellState(counts, live) })),
      }));
    return { list, coverage: total ? located / total : 0 };
  }, [rows, live]);

  if (loading) return <Skeleton height={200} radius={10} />;
  if (!rows?.length || grid.coverage < 0.3)
    return (
      <EmptyState
        icon="map-trifold"
        title="No yard locations in this list"
        body="The map needs a location column in the terminal export, like A01-02-3. The lists below still work."
      />
    );

  const look = (s: CellState) => {
    if (s === 'open') return { backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule };
    const key = s === 'review' ? 'review' : s;
    return { backgroundColor: bucketColours(c, key).bg, borderWidth: s === 'unexpected' ? 1 : 0, borderColor: 'rgba(14,14,14,0.35)' };
  };

  const maxBays = Math.max(...grid.list.map((r) => r.bays.length));

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ gap: 8, minWidth: Math.max(520, maxBays * 34 + 110) }}>
          {grid.list.map((r, ri) => {
            const done = r.bays.filter((b) => b.state !== 'open').length;
            const rowOn = selected === r.row;
            return (
              <Animated.View key={r.row} entering={FadeInDown.delay(Math.min(ri, 14) * 45).duration(320)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Show row ${r.row}`} onPress={() => onSelect(rowOn ? null : r.row)} style={{ width: 44 }}>
                  <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 13, textDecorationLine: rowOn ? 'underline' : 'none' }}>{r.row}</Txt>
                </Pressable>
                <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
                  {r.bays.map((b) => {
                    const on = selected === b.key;
                    return (
                      <Pressable
                        key={b.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.row} bay ${b.bay}: ${words[b.state]}`}
                        onPress={() => onSelect(on ? null : b.key)}
                        style={(s) => ({
                          flex: 1,
                          maxWidth: 48,
                          minWidth: 24,
                          height: 30,
                          borderRadius: 6,
                          ...look(b.state),
                          opacity: (s as { hovered?: boolean }).hovered ? 0.8 : 1,
                          boxShadow: on ? `0px 0px 0px 2px ${c.paper}, 0px 0px 0px 4px ${c.ink}` : undefined,
                        })}
                      />
                    );
                  })}
                </View>
                <Txt style={{ width: 60, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12 }} tone="muted">
                  {`${done} / ${r.bays.length}`}
                </Txt>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6 }}>
        {(['found', 'review', 'unexpected', live ? 'open' : 'missing'] as CellState[]).map((s) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, ...look(s) }} />
            <Txt variant="caption" tone="muted">
              {s === 'open' ? 'Not all scanned' : s === 'review' ? 'Needs review' : s === 'found' ? 'All found' : s === 'unexpected' ? 'Has an unexpected box' : 'Boxes missing'}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}
