import type { BayBlock, BayCounts, BayDto } from '@cymis/schemas';

/**
 * The status colour for anything needing a decision, on the grid, the map and
 * Overview. Kiptoo will confirm the final colour (recording 18:10): change it here.
 */
export const NEEDS_DECISION = 'review' as const;

/** A block with at least this many waiting is marked as a problem area. */
export const MANY_NEED_DECISION = 5;

/** More rows than this and the grid stops being readable, so it says so and offers the block filter. */
export const MAX_ROWS = 40;

export type CellState = 'found' | 'missing' | 'review' | 'unexpected' | 'open';

export function cellState(k: BayCounts, live: boolean): CellState {
  if (k.mismatched > 0) return 'review';
  if (k.missing > 0) return live ? 'open' : 'missing';
  if (k.unexpected > 0) return 'unexpected';
  return 'found';
}

export const total = (k: BayCounts) => k.found + k.missing + k.unexpected + k.mismatched;

/** Words for one bay, for screen readers and anyone who cannot rely on colour. */
export function bayWords(row: string, b: BayDto, live: boolean): string {
  const parts = [`${row} bay ${b.bay}`, `${b.found} of ${total(b)} found`];
  if (b.mismatched) parts.push(`${b.mismatched} ${b.mismatched === 1 ? 'needs' : 'need'} review`);
  if (b.unexpected) parts.push(`${b.unexpected} unexpected`);
  if (b.missing) parts.push(live ? `${b.missing} not scanned yet` : `${b.missing} missing`);
  return parts.join(', ');
}

/** A block id, the words below, or nothing for every block. */
export const NOT_IN_A_BLOCK = 'none';

export interface BayFilter {
  block?: string | undefined;
  reviewOnly?: boolean | undefined;
}

export function filterBays(bays: readonly BayDto[], f: BayFilter): BayDto[] {
  return bays.filter((b) => {
    if (f.reviewOnly && b.mismatched === 0) return false;
    if (f.block === NOT_IN_A_BLOCK) return b.blockId === null;
    if (f.block && b.blockId !== f.block) return false;
    return true;
  });
}

const byNumber = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

export interface GridRow {
  row: string;
  bays: BayDto[];
}

/** Rows in yard order, each with its bays in order, cut to what the screen can show. */
export function toRows(bays: readonly BayDto[]): { rows: GridRow[]; hiddenRows: number } {
  const map = new Map<string, BayDto[]>();
  for (const b of bays) map.set(b.row, [...(map.get(b.row) ?? []), b]);
  const all = [...map.entries()]
    .sort(([a], [b]) => byNumber(a, b))
    .map(([row, list]) => ({ row, bays: [...list].sort((a, b) => byNumber(a.bay, b.bay)) }));
  return { rows: all.slice(0, MAX_ROWS), hiddenRows: Math.max(0, all.length - MAX_ROWS) };
}

export const countDecisions = (bays: readonly BayDto[]) => bays.filter((b) => b.mismatched > 0).length;

/** The pills to offer. A single block is no choice, so it offers none. */
export function blockOptions(blocks: readonly BayBlock[], bays: readonly BayDto[]): { id: string; label: string }[] {
  const loose = bays.some((b) => b.blockId === null);
  if (blocks.length === 0 || (blocks.length === 1 && !loose)) return [];
  return [
    { id: 'all', label: 'All blocks' },
    ...blocks.map((b) => ({ id: b.id, label: b.name })),
    ...(loose ? [{ id: NOT_IN_A_BLOCK, label: 'Not in a block' }] : []),
  ];
}

/** "2 need review", or null. */
export function reviewWords(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? 'needs' : 'need'} review` : null;
}

/** The blocks most worth a look: those waiting on a decision first, then the busiest. */
export function worstBlocks<T extends BayCounts>(blocks: readonly T[], limit: number): T[] {
  return [...blocks].sort((a, b) => b.mismatched - a.mismatched || b.found + b.unexpected - (a.found + a.unexpected)).slice(0, limit);
}
