import * as SQLite from 'expo-sqlite';
import type { AuditDto, ScanDto } from '@cymis/schemas';
import type { CachedAudit, ExpectedRow, LocalPhoto, LocalScan, OfflineDb, QueueStatus } from './types';

// SQLite on the phone. Everything the crew needs to keep scanning with no
// signal lives here: the audits they were given, the expected lists, and the
// queue of scans and photos waiting to go out.

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  list_version INTEGER NOT NULL DEFAULT 0,
  saved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expected (
  audit_id TEXT NOT NULL,
  number TEXT NOT NULL,
  location TEXT,
  size_type TEXT,
  removed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (audit_id, number)
);
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY NOT NULL,
  audit_id TEXT NOT NULL,
  number TEXT NOT NULL,
  item TEXT NOT NULL,
  local_result TEXT NOT NULL,
  check_ok INTEGER NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  server TEXT,
  photo_uri TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scans_audit ON scans (audit_id, created_at);
CREATE INDEX IF NOT EXISTS scans_status ON scans (status, created_at);
CREATE INDEX IF NOT EXISTS scans_number ON scans (audit_id, number);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY NOT NULL,
  scan_id TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS photos_status ON photos (status);
`;

interface ScanRow {
  id: string;
  audit_id: string;
  number: string;
  item: string;
  local_result: LocalScan['localResult'];
  check_ok: number;
  status: QueueStatus;
  reason: string | null;
  server: string | null;
  photo_uri: string | null;
  created_at: string;
}

interface PhotoRow {
  id: string;
  scan_id: string;
  audit_id: string;
  uri: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  status: LocalPhoto['status'];
  attempts: number;
  last_error: string | null;
}

const toScan = (r: ScanRow): LocalScan => ({
  id: r.id,
  auditId: r.audit_id,
  number: r.number,
  item: JSON.parse(r.item),
  localResult: r.local_result,
  checkOk: r.check_ok === 1,
  status: r.status,
  reason: r.reason,
  server: r.server ? (JSON.parse(r.server) as ScanDto) : null,
  photoUri: r.photo_uri,
  createdAt: r.created_at,
});

const toPhoto = (r: PhotoRow): LocalPhoto => ({
  id: r.id,
  scanId: r.scan_id,
  auditId: r.audit_id,
  uri: r.uri,
  sizeBytes: r.size_bytes,
  width: r.width,
  height: r.height,
  status: r.status,
  attempts: r.attempts,
  lastError: r.last_error,
});

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function open() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('cymis.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

export const db: OfflineDb = {
  async init() {
    await open();
  },

  async saveAudit(audit: AuditDto) {
    const d = await open();
    await d.runAsync(
      `INSERT INTO audits (id, data, list_version, saved_at) VALUES (?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at`,
      audit.id,
      JSON.stringify(audit),
      new Date().toISOString(),
    );
  },

  async audits() {
    const d = await open();
    const rows = await d.getAllAsync<{ data: string; list_version: number; saved_at: string }>(
      'SELECT data, list_version, saved_at FROM audits ORDER BY saved_at DESC',
    );
    return rows.map((r) => ({ audit: JSON.parse(r.data), listVersion: r.list_version, savedAt: r.saved_at }) as CachedAudit);
  },

  async audit(id) {
    const d = await open();
    const r = await d.getFirstAsync<{ data: string; list_version: number; saved_at: string }>(
      'SELECT data, list_version, saved_at FROM audits WHERE id = ?',
      id,
    );
    return r ? { audit: JSON.parse(r.data), listVersion: r.list_version, savedAt: r.saved_at } : null;
  },

  async applyExpected(auditId, listVersion, full, rows) {
    const d = await open();
    await d.withExclusiveTransactionAsync(async (tx) => {
      if (full) await tx.runAsync('DELETE FROM expected WHERE audit_id = ?', auditId);
      const stmt = await tx.prepareAsync(
        `INSERT INTO expected (audit_id, number, location, size_type, removed) VALUES ($a, $n, $l, $s, $r)
         ON CONFLICT(audit_id, number) DO UPDATE SET location = excluded.location, size_type = excluded.size_type, removed = excluded.removed`,
      );
      try {
        for (const r of rows) {
          await stmt.executeAsync({ $a: auditId, $n: r.number, $l: r.location, $s: r.sizeType, $r: r.removed ? 1 : 0 });
        }
      } finally {
        await stmt.finalizeAsync();
      }
      await tx.runAsync('UPDATE audits SET list_version = ? WHERE id = ?', listVersion, auditId);
    });
  },

  async expected(auditId, number) {
    const d = await open();
    const r = await d.getFirstAsync<{ location: string | null; size_type: string | null; removed: number }>(
      'SELECT location, size_type, removed FROM expected WHERE audit_id = ? AND number = ?',
      auditId,
      number,
    );
    return r ? ({ auditId, number, location: r.location, sizeType: r.size_type, removed: r.removed === 1 } satisfies ExpectedRow) : null;
  },

  async expectedCount(auditId) {
    const d = await open();
    const r = await d.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM expected WHERE audit_id = ? AND removed = 0', auditId);
    return r?.n ?? 0;
  },

  async matchedCount(auditId) {
    const d = await open();
    const r = await d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(DISTINCT number) AS n FROM scans WHERE audit_id = ? AND local_result = 'matched' AND status != 'rejected'`,
      auditId,
    );
    return r?.n ?? 0;
  },

  async addScan(s) {
    const d = await open();
    await d.runAsync(
      `INSERT OR IGNORE INTO scans (id, audit_id, number, item, local_result, check_ok, status, reason, server, photo_uri, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.auditId,
      s.number,
      JSON.stringify(s.item),
      s.localResult,
      s.checkOk ? 1 : 0,
      s.status,
      s.reason,
      s.server ? JSON.stringify(s.server) : null,
      s.photoUri,
      s.createdAt,
    );
  },

  async scanForNumber(auditId, number) {
    const d = await open();
    const r = await d.getFirstAsync<ScanRow>(
      `SELECT * FROM scans WHERE audit_id = ? AND number = ? AND status != 'rejected' ORDER BY created_at ASC LIMIT 1`,
      auditId,
      number,
    );
    return r ? toScan(r) : null;
  },

  async scans(auditId, limit, status) {
    const d = await open();
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (auditId) {
      where.push('audit_id = ?');
      args.push(auditId);
    }
    if (status) {
      where.push('status = ?');
      args.push(status);
    }
    const rows = await d.getAllAsync<ScanRow>(
      `SELECT * FROM scans ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
      ...args,
      limit,
    );
    return rows.map(toScan);
  },

  async scan(id) {
    const d = await open();
    const r = await d.getFirstAsync<ScanRow>('SELECT * FROM scans WHERE id = ?', id);
    return r ? toScan(r) : null;
  },

  async queuedScans(limit) {
    const d = await open();
    const rows = await d.getAllAsync<ScanRow>(`SELECT * FROM scans WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?`, limit);
    return rows.map(toScan);
  },

  async markSent(id, server) {
    const d = await open();
    await d.runAsync(
      `UPDATE scans SET status = 'sent', reason = NULL, server = COALESCE(?, server) WHERE id = ?`,
      server ? JSON.stringify(server) : null,
      id,
    );
  },

  async markRejected(id, reason) {
    const d = await open();
    await d.runAsync(`UPDATE scans SET status = 'rejected', reason = ? WHERE id = ?`, reason, id);
  },

  async requeue(id, item) {
    const d = await open();
    await d.runAsync(`UPDATE scans SET status = 'queued', reason = NULL, item = ?, number = ? WHERE id = ?`, JSON.stringify(item), item.containerNumber, id);
  },

  async addPhoto(p) {
    const d = await open();
    await d.runAsync(
      `INSERT OR IGNORE INTO photos (id, scan_id, audit_id, uri, size_bytes, width, height, status, attempts, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id,
      p.scanId,
      p.auditId,
      p.uri,
      p.sizeBytes,
      p.width,
      p.height,
      p.status,
      p.attempts,
      p.lastError,
    );
  },

  async queuedPhotos(limit) {
    const d = await open();
    // A photo only goes once its scan is on the server, or the presign fails.
    const rows = await d.getAllAsync<PhotoRow>(
      `SELECT p.* FROM photos p JOIN scans s ON s.id = p.scan_id
       WHERE p.status = 'queued' AND s.status = 'sent' ORDER BY p.attempts ASC, p.id ASC LIMIT ?`,
      limit,
    );
    return rows.map(toPhoto);
  },

  async markPhoto(id, patch) {
    const d = await open();
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (patch.status) {
      sets.push('status = ?');
      args.push(patch.status);
    }
    if (patch.attempts !== undefined) {
      sets.push('attempts = ?');
      args.push(patch.attempts);
    }
    if (patch.lastError !== undefined) {
      sets.push('last_error = ?');
      args.push(patch.lastError);
    }
    if (!sets.length) return;
    await d.runAsync(`UPDATE photos SET ${sets.join(', ')} WHERE id = ?`, ...args, id);
  },

  async counts() {
    const d = await open();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const r = await d.getFirstAsync<{ queued: number; rejected: number; today: number }>(
      `SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today
       FROM scans`,
      start.toISOString(),
    );
    const p = await d.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM photos WHERE status = 'queued'`);
    return { queued: r?.queued ?? 0, rejected: r?.rejected ?? 0, today: r?.today ?? 0, photos: p?.n ?? 0 };
  },

  async wipe() {
    const d = await open();
    await d.execAsync('DELETE FROM photos; DELETE FROM scans; DELETE FROM expected; DELETE FROM audits;');
  },
};
