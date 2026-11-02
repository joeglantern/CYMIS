import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayWord, eatTime, longDay, parseTime, pickShift, shiftTimes, toUtcIso } from './eat';

describe('East Africa Time', () => {
  it('reads a UTC moment as EAT, including across midnight', () => {
    expect(eatTime('2026-11-02T03:00:00.000Z')).toBe('06:00');
    expect(eatTime('2026-11-02T22:30:00.000Z')).toBe('01:30');
    expect(dayKey('2026-11-02T22:30:00.000Z')).toBe('2026-11-03');
    expect(dayKey('2026-11-02T20:59:59.000Z')).toBe('2026-11-02');
  });

  it('stores an EAT time as UTC and reads back the same', () => {
    const iso = toUtcIso('2026-11-03', '06:00');
    expect(iso).toBe('2026-11-03T03:00:00.000Z');
    expect(eatTime(iso)).toBe('06:00');
    expect(dayKey(iso)).toBe('2026-11-03');
  });

  it('handles the first hours of a day, which are the day before in UTC', () => {
    expect(toUtcIso('2026-11-03', '01:00')).toBe('2026-11-02T22:00:00.000Z');
  });

  it('rolls days over month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('names the day', () => {
    const now = new Date('2026-11-02T10:00:00.000Z').getTime();
    expect(dayWord('2026-11-02', now)).toBe('Today');
    expect(dayWord('2026-11-03', now)).toBe('Tomorrow');
    expect(dayWord('2026-11-01', now)).toBe('Yesterday');
    expect(dayWord('2026-11-05', now)).toBe('Thu 5 Nov');
    expect(longDay('2026-11-02')).toBe('Monday 2 November');
  });

  it('treats today as the EAT day, not the UTC day', () => {
    // 22:00 UTC on the 2nd is already 01:00 on the 3rd in Mombasa.
    const now = new Date('2026-11-02T22:00:00.000Z').getTime();
    expect(dayWord('2026-11-03', now)).toBe('Today');
  });
});

describe('parseTime', () => {
  it('accepts the ways people type a time', () => {
    expect(parseTime('6')).toBe('06:00');
    expect(parseTime('06:00')).toBe('06:00');
    expect(parseTime('0600')).toBe('06:00');
    expect(parseTime('6:30')).toBe('06:30');
    expect(parseTime('14.15')).toBe('14:15');
    expect(parseTime(' 23:59 ')).toBe('23:59');
  });

  it('refuses what is not a time', () => {
    for (const bad of ['', '24:00', '12:60', 'six', '123456', '6pm']) expect(parseTime(bad)).toBeNull();
  });
});

describe('shiftTimes', () => {
  it('keeps a day shift on one date', () => {
    expect(shiftTimes('2026-11-03', '06:00', '14:00')).toEqual({
      startsAt: '2026-11-03T03:00:00.000Z',
      endsAt: '2026-11-03T11:00:00.000Z',
      nextDay: false,
    });
  });

  it('ends a night shift the next morning', () => {
    expect(shiftTimes('2026-11-03', '22:00', '06:00')).toEqual({
      startsAt: '2026-11-03T19:00:00.000Z',
      endsAt: '2026-11-04T03:00:00.000Z',
      nextDay: true,
    });
  });

  it('refuses equal times', () => {
    expect(shiftTimes('2026-11-03', '06:00', '06:00')).toBeNull();
  });
});

describe('pickShift', () => {
  const a = { startsAt: '2026-11-02T03:00:00.000Z', endsAt: '2026-11-02T11:00:00.000Z' };
  const b = { startsAt: '2026-11-03T03:00:00.000Z', endsAt: '2026-11-03T11:00:00.000Z' };
  const at = (s: string) => new Date(s).getTime();

  it('shows the running shift first', () => {
    expect(pickShift([b, a], at('2026-11-02T05:00:00.000Z'))).toBe(a);
  });
  it('then the next one', () => {
    expect(pickShift([a, b], at('2026-11-02T12:00:00.000Z'))).toBe(b);
  });
  it('then the most recent', () => {
    expect(pickShift([a, b], at('2026-11-05T12:00:00.000Z'))).toBe(b);
  });
  it('has nothing to show with no shifts', () => {
    expect(pickShift([])).toBeNull();
  });
});
