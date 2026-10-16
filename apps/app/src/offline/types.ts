import type { AuditDto, ScanDto, SyncScanItem } from '@cymis/schemas';

export type LocalResult = 'matched' | 'unexpected' | 'duplicate';
export type QueueStatus = 'queued' | 'sent' | 'rejected';

export interface ExpectedRow {
  auditId: string;
  number: string;
  location: string | null;
  sizeType: string | null;
  removed: boolean;
}

export interface LocalScan {
  id: string;
  auditId: string;
  number: string;
  item: SyncScanItem;
  localResult: LocalResult;
  checkOk: boolean;
  status: QueueStatus;
  reason: string | null;
  /** What the server said, once sent. The server is the source of truth. */
  server: ScanDto | null;
  createdAt: string;
  /** Local file of the door photo, until it is uploaded. */
  photoUri: string | null;
}

export interface LocalPhoto {
  id: string;
  scanId: string;
  auditId: string;
  uri: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  status: 'queued' | 'uploaded';
  attempts: number;
  lastError: string | null;
}

export interface CachedAudit {
  audit: AuditDto;
  listVersion: number;
  savedAt: string;
}

/** What both storage backends (SQLite on phones, memory on the web) provide. */
export interface OfflineDb {
  init(): Promise<void>;
  saveAudit(audit: AuditDto): Promise<void>;
  audits(): Promise<CachedAudit[]>;
  audit(id: string): Promise<CachedAudit | null>;
  applyExpected(auditId: string, listVersion: number, full: boolean, rows: ExpectedRow[]): Promise<void>;
  expected(auditId: string, number: string): Promise<ExpectedRow | null>;
  expectedCount(auditId: string): Promise<number>;
  /** Distinct boxes on the list this phone has scanned in an audit. */
  matchedCount(auditId: string): Promise<number>;
  addScan(scan: LocalScan): Promise<void>;
  scanForNumber(auditId: string, number: string): Promise<LocalScan | null>;
  scans(auditId: string | null, limit: number, status?: QueueStatus): Promise<LocalScan[]>;
  scan(id: string): Promise<LocalScan | null>;
  queuedScans(limit: number): Promise<LocalScan[]>;
  markSent(id: string, server: ScanDto | null): Promise<void>;
  markRejected(id: string, reason: string): Promise<void>;
  /** Puts a rejected scan back in the queue, after a fix. */
  requeue(id: string, item: LocalScan['item']): Promise<void>;
  addPhoto(photo: LocalPhoto): Promise<void>;
  queuedPhotos(limit: number): Promise<LocalPhoto[]>;
  markPhoto(id: string, patch: Partial<Pick<LocalPhoto, 'status' | 'attempts' | 'lastError'>>): Promise<void>;
  counts(): Promise<{ queued: number; rejected: number; photos: number; today: number }>;
  /** Removes everything for a signed out person. */
  wipe(): Promise<void>;
}
