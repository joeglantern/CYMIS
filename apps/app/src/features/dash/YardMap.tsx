import type { BayDto, BaysResponse } from '@cymis/schemas';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ApiError } from '@/api/http';
import { useBays } from '@/api/queries';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { EmptyState, FilterPills, Icon, Skeleton, Txt, bucketColours, type IconName } from '@/ui';
import { MAX_ROWS, NEEDS_DECISION, NOT_IN_A_BLOCK, bayWords, blockOptions, cellState, countDecisions, filterBays, toRows, total, type CellState } from './bays';

const LEGEND: Record<CellState, string> = {
  found: 'All found',
  review: 'Needs review, with how many',
  unexpected: 'Has an unexpected box',
  open: 'Not all scanned',
  missing: 'Boxes missing',
};

/** How each state looks. A found box stays grey. Only what needs someone stands out. */
function useCellLook() {
  const { c } = useTheme();
  return (s: CellState): { box: object; fg: string; icon?: IconName } => {
    switch (s) {
      case 'found':
        return { box: { backgroundColor: c.rule }, fg: c.ink2, icon: 'check' };
      case 'open':
        return { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.ruleStrong }, fg: c.muted };
      case 'review': {
        const k = bucketColours(c, NEEDS_DECISION);
        return { box: { backgroundColor: k.bg }, fg: k.fg };
      }
      case 'unexpected': {
        const k = bucketColours(c, 'unexpected');
        return { box: { backgroundColor: k.bg }, fg: k.fg, icon: 'warning-circle' };
      }
      case 'missing': {
        const k = bucketColours(c, 'missing');
        return { box: { backgroundColor: k.bg }, fg: k.fg, icon: 'x' };
      }
    }
  };
}

function CellMark({ state, bay, look }: { state: CellState; bay: BayDto; look: ReturnType<ReturnType<typeof useCellLook>> }) {
  if (state === 'review') {
    return <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 16 }} color={look.fg}>{bay.mismatched > 99 ? '99+' : String(bay.mismatched)}</Txt>;
  }
  return look.icon ? <Icon name={look.icon} size={14} weight="bold" color={look.fg} /> : null;
}

/** One square per bay. Rows are the first part of the location code. */
function Grid({ bays, live, selected, onSelect }: { bays: BayDto[]; live: boolean; selected?: string | null | undefined; onSelect?: ((place: string | null) => void) | undefined }) {
  const { c } = useTheme();
  const lookOf = useCellLook();
  const { rows, hiddenRows } = useMemo(() => toRows(bays), [bays]);
  const maxBays = Math.max(1, ...rows.map((r) => r.bays.length));
  const states = new Set(bays.map((b) => cellState(b, live)));

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        {/* Room around the squares, so a focus ring is not cut off by the scroller. */}
        <View style={{ gap: 8, paddingVertical: 4, paddingRight: 4, minWidth: Math.max(onSelect ? 520 : 320, maxBays * 34 + 110) }}>
          {rows.map((r) => {
            const done = r.bays.filter((b) => cellState(b, live) !== 'open').length;
            const rowOn = selected === r.row;
            return (
              <View key={r.row} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {onSelect ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Show row ${r.row}`} onPress={() => onSelect(rowOn ? null : r.row)} style={{ width: 44 }}>
                    <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 13, textDecorationLine: rowOn ? 'underline' : 'none' }}>{r.row}</Txt>
                  </Pressable>
                ) : (
                  <Txt style={{ width: 44, fontFamily: fonts.monoMedium, fontSize: 13 }}>{r.row}</Txt>
                )}
                <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
                  {r.bays.map((b) => {
                    const key = `${r.row}-${b.bay}`;
                    const on = selected === key;
                    const state = cellState(b, live);
                    const look = lookOf(state);
                    const cell = { flex: 1, maxWidth: 48, minWidth: 24, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', ...look.box } as const;
                    return onSelect ? (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={bayWords(r.row, b, live)}
                        accessibilityState={{ selected: on }}
                        onPress={() => onSelect(on ? null : key)}
                        style={(s) => ({
                          ...cell,
                          opacity: (s as { hovered?: boolean }).hovered ? 0.8 : 1,
                          boxShadow: on ? `0px 0px 0px 2px ${c.paper}, 0px 0px 0px 4px ${c.ink}` : undefined,
                        })}
                      >
                        <CellMark state={state} bay={b} look={look} />
                      </Pressable>
                    ) : (
                      <View key={key} accessible accessibilityLabel={bayWords(r.row, b, live)} style={cell}>
                        <CellMark state={state} bay={b} look={look} />
                      </View>
                    );
                  })}
                </View>
                <Txt style={{ width: 60, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12 }} tone="muted" accessibilityLabel={`${done} of ${r.bays.length} bays done`}>
                  {`${done} / ${r.bays.length}`}
                </Txt>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {hiddenRows > 0 ? (
        <Txt variant="caption" tone="ink2">
          {`Showing the first ${MAX_ROWS} rows. ${hiddenRows} more ${hiddenRows === 1 ? 'row is' : 'rows are'} not shown. Pick a block to narrow it down.`}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6 }}>
        {(['found', 'review', 'unexpected', live ? 'open' : 'missing'] as CellState[])
          .filter((s) => s !== 'unexpected' || states.has(s))
          .map((s) => {
            const look = lookOf(s);
            return (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 16, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center', ...look.box }}>
                  {s === 'review' ? <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 10, lineHeight: 12 }} color={look.fg}>2</Txt> : look.icon ? <Icon name={look.icon} size={10} weight="bold" color={look.fg} /> : null}
                </View>
                <Txt variant="caption" tone="muted">
                  {LEGEND[s]}
                </Txt>
              </View>
            );
          })}
      </View>
    </View>
  );
}

function outsideWords(data: BaysResponse, compact: boolean | undefined): string | null {
  const k = data.withoutLocation;
  const n = total(k);
  if (!n) return null;
  const base =
    k.unexpected === n
      ? `${n} unexpected ${n === 1 ? 'box is' : 'boxes are'} not on the grid, because the list gives no location for ${n === 1 ? 'it' : 'them'}.`
      : `${n} ${n === 1 ? 'box has' : 'boxes have'} no yard location, so ${n === 1 ? 'it is' : 'they are'} not on the grid.`;
  // Otherwise the plan says something is waiting and the grid seems to say nothing is.
  if (!k.mismatched || compact) return base;
  return `${base} ${k.mismatched} of them ${k.mismatched === 1 ? 'needs' : 'need'} a decision in the Review queue.`;
}

/**
 * The bay grid with its filters, kept in the address so a view can be shared.
 * Clerks get this too: it holds counts only, and without onSelect the bays are not buttons.
 */
export function LiveBays({
  auditId,
  live,
  selected,
  onSelect,
  compact,
  title,
}: {
  auditId: string;
  live: boolean;
  selected?: string | null;
  onSelect?: (place: string | null) => void;
  compact?: boolean;
  title?: ReactNode;
}) {
  const params = useLocalSearchParams<{ block?: string; only?: string }>();
  const q = useBays(auditId, live);
  const data = q.data;
  const allBays = useMemo(() => data?.bays ?? [], [data]);
  const options = useMemo(() => (data ? blockOptions(data.blocks, allBays) : []), [data, allBays]);
  const block = options.some((o) => o.id === params.block) ? params.block : undefined;
  const reviewOnly = params.only === 'review';
  const shown = useMemo(() => filterBays(allBays, { block, reviewOnly }), [allBays, block, reviewOnly]);
  const inBlock = useMemo(() => filterBays(allBays, { block }), [allBays, block]);
  const decisions = countDecisions(inBlock);

  if (q.isPending) {
    return (
      <>
        {title}
        <Skeleton height={compact ? 120 : 200} radius={10} />
      </>
    );
  }

  const offline = q.error instanceof ApiError && q.error.offline;
  if (!data) {
    if (compact) {
      return (
        <>
          {title}
          <Txt variant="bodySm" tone="muted">
            {offline ? 'The yard map needs signal. Your scans are safe and keep saving.' : 'The yard map could not load. Your scans are safe and keep saving.'}
          </Txt>
        </>
      );
    }
    return (
      <>
        {title}
        <EmptyState icon="warning-circle" title="Could not load the yard map" body={(q.error as Error | null)?.message ?? 'Try again in a moment.'} />
      </>
    );
  }

  if (!allBays.length) {
    return compact ? null : (
      <>
        {title}
        <EmptyState icon="map-trifold" title="No yard locations in this list" body="The map needs a location column in the terminal export, like A01-02-3. The lists below still work." />
      </>
    );
  }

  const outside = outsideWords(data, compact);
  return (
    <>
      {title}
      <View style={{ gap: 12 }}>
        {options.length ? (
          <FilterPills<string> label="Which block" value={block ?? 'all'} onChange={(v) => router.setParams({ block: v === 'all' ? undefined : v })} options={options} />
        ) : null}
        <FilterPills<string>
          label="Show"
          value={reviewOnly ? 'review' : 'all'}
          onChange={(v) => router.setParams({ only: v === 'review' ? 'review' : undefined })}
          options={[
            { id: 'all', label: 'All bays' },
            { id: 'review', label: 'Needs review only', count: decisions },
          ]}
        />
        {shown.length ? (
          <Grid bays={shown} live={live} selected={selected} onSelect={onSelect} />
        ) : (
          <Txt variant="bodySm" tone="muted" style={{ paddingVertical: 12 }}>
            {reviewOnly ? 'No bay here needs a decision.' : block === NOT_IN_A_BLOCK ? 'Every bay is in a block.' : 'No bays here yet.'}
          </Txt>
        )}
        {outside ? (
          <Txt variant="caption" tone="muted">
            {outside}
          </Txt>
        ) : null}
        {q.isError ? (
          <Txt variant="caption" tone="ink2">
            {offline ? 'No signal. This shows the last counts the phone received.' : 'Could not refresh. This shows the last counts received.'}
          </Txt>
        ) : null}
      </View>
    </>
  );
}
