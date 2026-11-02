import type { BayDto } from '@cymis/schemas';
import { describe, expect, it } from 'vitest';
import { MAX_ROWS, NOT_IN_A_BLOCK, bayWords, blockOptions, cellState, filterBays, reviewWords, toRows, worstBlocks } from './bays';

const bay = (row: string, b: string, k: Partial<BayDto> = {}): BayDto => ({ row, bay: b, blockId: null, found: 0, missing: 0, unexpected: 0, mismatched: 0, ...k });

describe('cellState', () => {
  it('puts a decision above everything else', () => {
    expect(cellState({ found: 5, missing: 5, unexpected: 1, mismatched: 1 }, true)).toBe('review');
  });
  it('calls unscanned boxes open while live and missing once closed', () => {
    expect(cellState({ found: 1, missing: 1, unexpected: 0, mismatched: 0 }, true)).toBe('open');
    expect(cellState({ found: 1, missing: 1, unexpected: 0, mismatched: 0 }, false)).toBe('missing');
  });
  it('says found only when nothing else is going on', () => {
    expect(cellState({ found: 3, missing: 0, unexpected: 0, mismatched: 0 }, true)).toBe('found');
    expect(cellState({ found: 3, missing: 0, unexpected: 1, mismatched: 0 }, true)).toBe('unexpected');
  });
});

describe('filterBays', () => {
  const bays = [bay('A01', '1', { blockId: 'a', mismatched: 2 }), bay('A01', '2', { blockId: 'a', found: 1 }), bay('B01', '1', { blockId: 'b', found: 1 }), bay('C01', '1', { found: 1 })];
  it('shows everything with no filter', () => {
    expect(filterBays(bays, {})).toHaveLength(4);
  });
  it('narrows to a block, to nothing in a block, and to review', () => {
    expect(filterBays(bays, { block: 'b' }).map((b) => b.row)).toEqual(['B01']);
    expect(filterBays(bays, { block: NOT_IN_A_BLOCK }).map((b) => b.row)).toEqual(['C01']);
    expect(filterBays(bays, { reviewOnly: true }).map((b) => `${b.row}-${b.bay}`)).toEqual(['A01-1']);
  });
  it('combines them', () => {
    expect(filterBays(bays, { block: 'b', reviewOnly: true })).toEqual([]);
  });
});

describe('toRows', () => {
  it('orders rows and bays as numbers, not as text', () => {
    const { rows } = toRows([bay('A10', '2'), bay('A2', '10'), bay('A2', '9')]);
    expect(rows.map((r) => r.row)).toEqual(['A2', 'A10']);
    expect(rows[0]!.bays.map((b) => b.bay)).toEqual(['9', '10']);
  });
  it('says how many rows it left out', () => {
    const many = Array.from({ length: MAX_ROWS + 3 }, (_, i) => bay(`R${i}`, '1'));
    const { rows, hiddenRows } = toRows(many);
    expect(rows).toHaveLength(MAX_ROWS);
    expect(hiddenRows).toBe(3);
  });
});

describe('blockOptions', () => {
  const block = (id: string) => ({ id, name: id.toUpperCase(), found: 0, missing: 0, unexpected: 0, mismatched: 0 });
  it('offers nothing when there is no real choice', () => {
    expect(blockOptions([], [bay('A', '1')])).toEqual([]);
    expect(blockOptions([block('a')], [bay('A', '1', { blockId: 'a' })])).toEqual([]);
  });
  it('offers every block, and a place for bays no block claims', () => {
    expect(blockOptions([block('a')], [bay('A', '1', { blockId: 'a' }), bay('Z', '1')]).map((o) => o.id)).toEqual(['all', 'a', NOT_IN_A_BLOCK]);
  });
});

describe('words', () => {
  it('reads a bay out in full, so colour is never the only clue', () => {
    expect(bayWords('A01', bay('A01', '2', { found: 1, mismatched: 1, missing: 2 }), true)).toBe('A01 bay 2, 1 of 4 found, 1 needs review, 2 not scanned yet');
    expect(bayWords('A01', bay('A01', '2', { found: 1, missing: 2 }), false)).toBe('A01 bay 2, 1 of 3 found, 2 missing');
  });
  it('agrees with the number', () => {
    expect(reviewWords(0)).toBeNull();
    expect(reviewWords(1)).toBe('1 needs review');
    expect(reviewWords(2)).toBe('2 need review');
  });
  it('ranks blocks by decisions, then by work done', () => {
    const k = (name: string, mismatched: number, found: number) => ({ name, mismatched, found, missing: 0, unexpected: 0 });
    expect(worstBlocks([k('quiet', 0, 1), k('busy', 0, 9), k('bad', 2, 0)], 2).map((b) => b.name)).toEqual(['bad', 'busy']);
  });
});
