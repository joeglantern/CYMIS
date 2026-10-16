import type { CachedAudit, ExpectedRow, LocalPhoto, LocalScan, OfflineDb } from './types';

// The web build is the supervisor dashboard, which works online. This keeps
// the crew screens usable in a browser (for demos and testing) with the same
// interface as SQLite, held in memory for the session.

const audits = new Map<string, CachedAudit>();
const expected = new Map<string, Map<string, ExpectedRow>>();
const scans = new Map<string, LocalScan>();
const photos = new Map<string, LocalPhoto>();

const byNewest = (a: LocalScan, b: LocalScan) => (a.createdAt < b.createdAt ? 1 : -1);

export const db: OfflineDb = {
  async init() {},

  async saveAudit(audit) {
    const prev = audits.get(audit.id);
    audits.set(audit.id, { audit, listVersion: prev?.listVersion ?? 0, savedAt: new Date().toISOString() });
  },
  async audits() {
    return [...audits.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  },
  async audit(id) {
    return audits.get(id) ?? null;
  },

  async applyExpected(auditId, listVersion, full, rows) {
    const map = full ? new Map<string, ExpectedRow>() : (expected.get(auditId) ?? new Map<string, ExpectedRow>());
    for (const r of rows) map.set(r.number, r);
    expected.set(auditId, map);
    const a = audits.get(auditId);
    if (a) a.listVersion = listVersion;
  },
  async expected(auditId, number) {
    return expected.get(auditId)?.get(number) ?? null;
  },
  async expectedCount(auditId) {
    return [...(expected.get(auditId)?.values() ?? [])].filter((r) => !r.removed).length;
  },

  async matchedCount(auditId) {
    return new Set([...scans.values()].filter((s) => s.auditId === auditId && s.localResult === 'matched' && s.status !== 'rejected').map((s) => s.number)).size;
  },

  async addScan(s) {
    if (!scans.has(s.id)) scans.set(s.id, s);
  },
  async scanForNumber(auditId, number) {
    return (
      [...scans.values()]
        .filter((s) => s.auditId === auditId && s.number === number && s.status !== 'rejected')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0] ?? null
    );
  },
  async scans(auditId, limit, status) {
    return [...scans.values()]
      .filter((s) => (!auditId || s.auditId === auditId) && (!status || s.status === status))
      .sort(byNewest)
      .slice(0, limit);
  },
  async scan(id) {
    return scans.get(id) ?? null;
  },
  async queuedScans(limit) {
    return [...scans.values()]
      .filter((s) => s.status === 'queued')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, limit);
  },
  async markSent(id, server) {
    const s = scans.get(id);
    if (s) scans.set(id, { ...s, status: 'sent', reason: null, server: server ?? s.server });
  },
  async markRejected(id, reason) {
    const s = scans.get(id);
    if (s) scans.set(id, { ...s, status: 'rejected', reason });
  },
  async requeue(id, item) {
    const s = scans.get(id);
    if (s) scans.set(id, { ...s, status: 'queued', reason: null, item, number: item.containerNumber });
  },

  async addPhoto(p) {
    if (!photos.has(p.id)) photos.set(p.id, p);
  },
  async queuedPhotos(limit) {
    return [...photos.values()].filter((p) => p.status === 'queued' && scans.get(p.scanId)?.status === 'sent').slice(0, limit);
  },
  async markPhoto(id, patch) {
    const p = photos.get(id);
    if (p) photos.set(id, { ...p, ...patch });
  },

  async counts() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const all = [...scans.values()];
    return {
      queued: all.filter((s) => s.status === 'queued').length,
      rejected: all.filter((s) => s.status === 'rejected').length,
      today: all.filter((s) => s.createdAt >= start.toISOString()).length,
      photos: [...photos.values()].filter((p) => p.status === 'queued').length,
    };
  },

  async wipe() {
    audits.clear();
    expected.clear();
    scans.clear();
    photos.clear();
  },
};
