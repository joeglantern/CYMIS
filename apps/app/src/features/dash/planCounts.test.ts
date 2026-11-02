import type { AuditCounts } from '@cymis/schemas';
import { describe, expect, it } from 'vitest';
import { clerkCounts, onListReview } from './planCounts';

const counts = (k: Partial<AuditCounts>): AuditCounts => ({
  expected: 0,
  found: 0,
  missing: 0,
  unexpected: 0,
  mismatched: 0,
  offListReview: 0,
  duplicates: 0,
  scans: 0,
  pendingReview: 0,
  ...k,
});

describe('clerkCounts', () => {
  it('adds up with boxes waiting for review: the 60, 4, 6 plan shows 50 left, not 56', () => {
    const c = clerkCounts(counts({ expected: 60, found: 4, mismatched: 6, missing: 50 }), { expected: 60, matched: 0 });
    expect(c).toMatchObject({ found: 4, review: 6, left: 50 });
    expect(c.found + c.review + c.left).toBe(c.expected);
  });

  it('keeps a box waiting for review that is not on the list out of the sum', () => {
    const k = counts({ expected: 7, found: 4, mismatched: 1, offListReview: 1, missing: 3 });
    const c = clerkCounts(k, undefined);
    expect(c.left).toBe(3);
    expect(c.found + onListReview(k) + c.left).toBe(c.expected);
  });

  it('counts scans on this phone not sent yet as found, without counting review twice', () => {
    // The phone has matched 8. The server has 4 found and 2 of the phone's in review.
    const c = clerkCounts(counts({ expected: 20, found: 4, mismatched: 2, missing: 14 }), { expected: 20, matched: 8 });
    expect(c).toMatchObject({ found: 6, review: 2, left: 12 });
    expect(c.found + c.review + c.left).toBe(20);
  });

  it('uses the higher of server and phone, since everyone else counts too', () => {
    expect(clerkCounts(counts({ expected: 20, found: 15, missing: 5 }), { expected: 20, matched: 3 })).toMatchObject({ found: 15, left: 5 });
  });

  it('works from the phone alone with no signal', () => {
    expect(clerkCounts(undefined, { expected: 9, matched: 2 })).toMatchObject({ expected: 9, found: 2, review: 0, left: 7 });
  });

  it('copes with a plan saved before the field existed', () => {
    const old = { expected: 5, found: 1, mismatched: 1, missing: 3 } as AuditCounts;
    expect(clerkCounts(old, undefined).left).toBe(3);
  });

  it('never goes below zero', () => {
    expect(clerkCounts(counts({ expected: 2, found: 3 }), undefined).left).toBe(0);
  });
});
