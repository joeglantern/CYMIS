import type { AuditCounts } from '@cymis/schemas';

/**
 * How a yard plan's expected list divides up, in one place so every screen adds up:
 *
 *   expected = found + on the list and waiting for review + left to scan
 *
 * A box waiting for review is neither found nor left. Working out "left" as
 * expected minus found counted those boxes twice.
 *
 * Unexpected boxes, and boxes waiting for review that are not on the list, are
 * extra to the list and sit outside that sum.
 */
export function onListReview(k: Pick<AuditCounts, 'mismatched'> & Partial<Pick<AuditCounts, 'offListReview'>>): number {
  // A plan saved on a phone before this field existed has no count of it.
  return Math.max(0, k.mismatched - (k.offListReview ?? 0));
}

export interface PlanCounts {
  expected: number;
  found: number;
  /** Waiting for a decision, on or off the list. */
  review: number;
  unexpected: number;
  /** Still to scan. */
  left: number;
}

/**
 * The counts a clerk's screen shows. The server knows everyone's work, and this
 * phone may be ahead of it with scans not sent yet. Those count as found until
 * the server says otherwise, and never twice.
 */
export function clerkCounts(k: AuditCounts | undefined, local: { expected?: number; matched?: number } | undefined): PlanCounts {
  const expected = k?.expected || local?.expected || 0;
  const waiting = k ? onListReview(k) : 0;
  const handled = Math.max((k?.found ?? 0) + waiting, local?.matched ?? 0);
  return {
    expected,
    found: handled - waiting,
    review: k?.mismatched ?? 0,
    unexpected: k?.unexpected ?? 0,
    left: Math.max(0, expected - handled),
  };
}
