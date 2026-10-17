import * as Crypto from 'expo-crypto';
import type { AuditDto, ContainerEventType, Role, SectionKind } from '@cymis/schemas';

export function time(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function day(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function dayTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${day(iso)}, ${time(iso)}`;
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function minutesAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  return day(iso);
}

export const roleWords: Record<Role, string> = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', AUDITOR: 'Yard crew' };

export const statusWords: Record<AuditDto['status'], string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Live',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const sectionKindWords: Record<SectionKind, string> = {
  YARD_BLOCK: 'Yard block',
  VERIFICATION_BAY: 'Verification bay',
  SGR_LOADING: 'Rail loading',
  GATE: 'Gate',
  QUAY: 'Quay',
  OTHER: 'Other',
};

export const eventWords: Record<ContainerEventType, string> = {
  IMPORTED: 'Put on an expected list',
  AUDITED: 'Scanned in an audit',
  DISCHARGED: 'Discharged from the ship',
  IN_YARD: 'In the yard',
  MOVED_TO_CFS: 'Moved to a freight station',
  RAILED: 'Loaded on rail',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  GATE_OUT: 'Left through the gate',
};

export const flagWords: Record<string, string> = {
  NUMBER_MISMATCH: 'Number differs',
  COLOUR_MISMATCH: 'Colour differs',
  CHECK_DIGIT_FAILED: 'Check digit fails',
};

/** Bucket counts for the bar, from audit counts. Missing is what is left of the expected list. */
export function barCounts(k: AuditDto['counts']) {
  return { found: k.found, review: k.mismatched, unexpected: k.unexpected, missing: k.missing };
}

/**
 * Props for BucketBar. While an audit is live, boxes nobody has reached yet
 * are not missing, so they show as a grey stretch instead of red.
 */
export function barProps(k: AuditDto['counts'], live: boolean) {
  const counts = barCounts(k);
  return live ? { counts: { ...counts, missing: 0 }, left: k.missing } : { counts, left: 0 };
}

/** A readable temporary password: three short words and two digits. */
const WORDS = [
  'crane', 'quay', 'berth', 'harbour', 'anchor', 'cargo', 'tide', 'reef', 'mango', 'coral', 'sail', 'pier',
  'lamp', 'stone', 'river', 'cedar', 'baobab', 'falcon', 'zebra', 'island', 'copper', 'amber', 'ocean', 'delta',
  'rail', 'bridge', 'signal', 'yard', 'lantern', 'canvas', 'summit', 'meadow',
];

// Uses the secure random source, not Math.random. The person must change it on first sign in.
export function makePassword(): string {
  const bytes = Crypto.getRandomBytes(4);
  const pick = (i: number) => WORDS[bytes[i]! % WORDS.length]!;
  const digits = String((bytes[3]! % 90) + 10);
  return `${pick(0)} ${pick(1)} ${pick(2)} ${digits}`;
}
