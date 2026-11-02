import { describe, expect, it } from 'vitest';
import { clerkChange, fromShiftWords, shiftLosses, shiftNames } from './shiftPlan';

const person = (id: string, fullName: string) => ({ id, fullName, staffId: id.toUpperCase(), role: 'AUDITOR' }) as never;
const shift = (id: string, name: string, clerkIds: string[], endsAt = '2026-11-03T11:00:00.000Z') => ({
  id,
  name,
  startsAt: '2026-11-03T03:00:00.000Z',
  endsAt,
  clerkIds,
});
const now = new Date('2026-11-02T10:00:00.000Z').getTime();

const plan = {
  assignees: [person('a', 'Asha'), person('b', 'Ben'), person('c', 'Chebet')],
  viaShiftIds: ['a', 'b'],
  shifts: [shift('day', 'Day shift', ['a', 'c']), shift('night', 'Night shift', ['b', 'c'])],
};

describe('words for the Clerks step', () => {
  it('joins shift names', () => {
    expect(shiftNames([{ name: 'Day' }])).toBe('Day');
    expect(shiftNames([{ name: 'Day' }, { name: 'Night' }])).toBe('Day and Night');
  });

  it('marks only people who came from a shift', () => {
    expect(fromShiftWords(plan, 'a')).toBe('From Day shift');
    expect(fromShiftWords(plan, 'c')).toBeNull(); // on shifts but assigned directly
  });

  it('copes with a plan saved on the phone before shifts existed', () => {
    expect(fromShiftWords({ shifts: undefined, viaShiftIds: undefined } as never, 'a')).toBeNull();
  });

  it('names what an untick would take away', () => {
    expect(shiftLosses(plan, ['a', 'b'])).toEqual([{ name: 'Chebet', shifts: 'Day shift and Night shift' }]);
    expect(shiftLosses(plan, ['a', 'b', 'c'])).toEqual([]);
  });
});

describe('clerkChange', () => {
  it('offers a move when the person is on another shift that has not ended', () => {
    const r = clerkChange(plan, 'night', ['b', 'c'], ['a', 'b', 'c'], now);
    expect(r.moves.map((m) => [m.name, m.from.map((s) => s.name)])).toEqual([['Asha', ['Day shift']]]);
  });

  it('does not offer to move someone off a shift already over', () => {
    const p = { ...plan, shifts: [shift('old', 'Old', ['a'], '2026-11-01T11:00:00.000Z'), shift('night', 'Night', [])] };
    expect(clerkChange(p, 'night', [], ['a'], now).moves).toEqual([]);
  });

  it('warns only when the person has nothing else holding them on the plan', () => {
    expect(clerkChange(plan, 'day', ['a', 'c'], ['c'], now).leaving.map((l) => l.name)).toEqual(['Asha']);
    expect(clerkChange(plan, 'day', ['a', 'c'], ['a'], now).leaving).toEqual([]); // Chebet is direct
  });
});
