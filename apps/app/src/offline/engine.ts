import { computeCheckDigit, isValidContainerNumber } from '@cymis/iso6346';
import type { AuditDto, ColourName, EntryMethod, GeoPoint, SyncScanItem } from '@cymis/schemas';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { endpoints } from '@/api/endpoints';
import { ApiError } from '@/api/http';
import { hasAccessToken, session, useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { deviceId, uuidv7 } from '@/lib/ids';
import { db } from './db';
import { deletePhoto, keepPhoto, uploadPhoto } from './photos';
import type { ExpectedRow, LocalResult, LocalScan } from './types';

export type { LocalScan, LocalResult } from './types';

interface QueueState {
  queued: number;
  rejected: number;
  photos: number;
  today: number;
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  /** Goes up whenever local scans change, so lists know to reload. */
  version: number;
}

export const useQueue = create<QueueState>(() => ({
  queued: 0,
  rejected: 0,
  photos: 0,
  today: 0,
  online: true,
  syncing: false,
  lastSyncedAt: null,
  version: 0,
}));

async function refreshCounts() {
  const counts = await db.counts();
  useQueue.setState((s) => ({ ...counts, version: s.version + 1 }));
}

/* Audits and expected lists */

/** Saves the audit and brings its expected list up to date. Safe to call often. */
export async function prepareAudit(auditId: string): Promise<AuditDto | null> {
  try {
    const audit = await endpoints.audit(auditId);
    await db.saveAudit(audit);
    const cached = await db.audit(auditId);
    const since = cached?.listVersion ?? 0;
    if (audit.status !== 'DRAFT' && audit.listVersion !== since) {
      const res = await endpoints.expected(auditId, since > 0 ? since : undefined);
      await db.applyExpected(
        auditId,
        res.listVersion,
        res.full,
        res.items.map(
          (e): ExpectedRow => ({ auditId, number: e.containerNumber, location: e.location, sizeType: e.sizeType, removed: e.removed }),
        ),
      );
    }
    return audit;
  } catch (err) {
    if (err instanceof ApiError && err.offline) return (await db.audit(auditId))?.audit ?? null;
    throw err;
  }
}

/** The audits this person was given. Falls back to the copy on the phone with no signal. */
export async function loadMyAudits(): Promise<{ audits: AuditDto[]; fromCache: boolean }> {
  try {
    // Crew see what they were given. Supervisors and admins scanning see every audit.
    const role = useSession.getState().user?.role;
    const page = await endpoints.audits(role === 'AUDITOR' ? { mine: true, limit: 50 } : { limit: 50 });
    for (const a of page.items) await db.saveAudit(a);
    // Keep expected lists of running audits ready for a dead zone.
    for (const a of page.items.filter((x) => x.status === 'ACTIVE')) {
      prepareAudit(a.id).catch(() => undefined);
    }
    return { audits: page.items, fromCache: false };
  } catch (err) {
    if (err instanceof ApiError && err.offline) {
      return { audits: (await db.audits()).map((c) => c.audit), fromCache: true };
    }
    throw err;
  }
}

/* The scan loop */

export interface NumberCheck {
  number: string;
  checkOk: boolean;
  result: LocalResult;
  expected: ExpectedRow | null;
  /** The earlier scan when this is a duplicate. */
  firstScan: LocalScan | null;
}

/**
 * What the phone thinks of a number before saving: on the list, not on the
 * list, or already scanned. The server checks again and has the last word.
 */
export async function checkNumber(auditId: string, number: string): Promise<NumberCheck> {
  const [expected, firstScan] = await Promise.all([db.expected(auditId, number), db.scanForNumber(auditId, number)]);
  const onList = !!expected && !expected.removed;
  const result: LocalResult = firstScan ? 'duplicate' : onList ? 'matched' : 'unexpected';
  return { number, checkOk: isValidContainerNumber(number), result, expected: onList ? expected : null, firstScan };
}

export interface SaveScanInput {
  auditId: string;
  number: string;
  entryMethod: EntryMethod;
  ocrRaw?: string;
  ocrConfidence?: number;
  colour?: ColourName;
  location?: GeoPoint;
  photo?: { uri: string; width: number; height: number };
  capturedAt: Date;
}

/** Saves to the phone first, then nudges the sync. Never waits on the network. */
export async function saveScan(input: SaveScanInput): Promise<LocalScan> {
  const check = await checkNumber(input.auditId, input.number);
  const id = uuidv7();
  const item: SyncScanItem = {
    id,
    auditId: input.auditId,
    containerNumber: input.number,
    entryMethod: input.entryMethod,
    capturedAt: input.capturedAt.toISOString(),
    deviceId: deviceId(),
    ...(input.ocrRaw ? { ocrRaw: input.ocrRaw.slice(0, 500) } : {}),
    ...(input.ocrConfidence !== undefined ? { ocrConfidence: input.ocrConfidence } : {}),
    ...(input.colour ? { colourChosen: input.colour } : {}),
    ...(input.location ? { location: input.location } : {}),
  };

  let photoUri: string | null = null;
  if (input.photo) {
    const photoId = uuidv7();
    try {
      const kept = await keepPhoto(input.photo.uri, photoId, input.photo.width, input.photo.height);
      photoUri = kept.uri;
      await db.addPhoto({
        id: photoId,
        scanId: id,
        auditId: input.auditId,
        uri: kept.uri,
        sizeBytes: kept.sizeBytes,
        width: kept.width,
        height: kept.height,
        status: 'queued',
        attempts: 0,
        lastError: null,
      });
    } catch {
      // The scan still counts without its photo. The supervisor sees it has none.
    }
  }

  const scan: LocalScan = {
    id,
    auditId: input.auditId,
    number: input.number,
    item,
    localResult: check.result,
    checkOk: check.checkOk,
    status: 'queued',
    reason: null,
    server: null,
    createdAt: new Date().toISOString(),
    photoUri,
  };
  await db.addScan(scan);
  await refreshCounts();
  scheduleSync(1200);
  return scan;
}

/**
 * Readers often miss the boxed check digit on a door. When the owner code and
 * serial come through, work out the check digit and accept the number only if
 * that exact container is on this audit's list. A misread almost never lands
 * on another listed box, so this stays safe.
 */
export async function matchByPrefix(auditId: string, rawText: string): Promise<string | null> {
  const text = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const seen = new Set<string>();
  for (let i = 0; i + 10 <= text.length; i++) {
    const head = text.slice(i, i + 10);
    if (!/^[A-Z]{3}[UJZ]\d{6}$/.test(head) || seen.has(head)) continue;
    seen.add(head);
    const full = `${head}${computeCheckDigit(head)}`;
    const row = await db.expected(auditId, full);
    if (row && !row.removed) return full;
  }
  return null;
}

/** Fix the number on a scan the server refused, and send it again. */
export async function fixRejected(scanId: string, number: string): Promise<void> {
  const scan = await db.scan(scanId);
  if (!scan) return;
  await db.requeue(scanId, { ...scan.item, containerNumber: number, entryMethod: 'OCR_CORRECTED' });
  await refreshCounts();
  scheduleSync(300);
}

export const recentScans = (auditId: string | null, limit = 50) => db.scans(auditId, limit);
export const scansByStatus = (status: LocalScan['status'], limit = 200) => db.scans(null, limit, status);
export const expectedCount = (auditId: string) => db.expectedCount(auditId);

/** What this phone knows about progress, for when there is no signal. */
export async function localProgress(auditId: string) {
  const [expected, matched] = await Promise.all([db.expectedCount(auditId), db.matchedCount(auditId)]);
  return { expected, matched, left: Math.max(0, expected - matched) };
}
export const cachedAudit = (auditId: string) => db.audit(auditId);

/* Sync */

let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(delayMs = 0) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}

export interface SyncOutcome {
  sent: number;
  rejected: number;
  /** Why nothing could be sent, in words the crew can read. */
  problem: 'offline' | 'signed-out' | 'error' | null;
  message?: string;
}

let running: Promise<SyncOutcome> | null = null;

/** Sends one batch. If the server refuses the whole batch, sends them one by one so a single bad scan never blocks the rest. */
async function sendBatch(batch: LocalScan[]): Promise<{ sent: number; rejected: number }> {
  let sent = 0;
  let rejected = 0;
  const apply = async (results: { id: string; status: string; reason?: string; scan?: LocalScan['server'] }[]) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        await db.markRejected(r.id, r.reason ?? 'The server did not accept this scan.');
        rejected++;
      } else {
        await db.markSent(r.id, r.scan ?? null);
        sent++;
      }
    }
  };
  try {
    await apply((await endpoints.syncScans(batch.map((s) => s.item))).results);
  } catch (err) {
    if (!(err instanceof ApiError) || err.offline || err.status === 401 || err.status >= 500 || err.status === 429) throw err;
    for (const scan of batch) {
      try {
        await apply((await endpoints.syncScans([scan.item])).results);
      } catch (one) {
        if (!(one instanceof ApiError) || one.offline || one.status === 401 || one.status >= 500 || one.status === 429) throw one;
        await db.markRejected(scan.id, one.message);
        rejected++;
      }
    }
  }
  return { sent, rejected };
}

/** Sends queued scans in batches of 100, then photos. One run at a time. Always says what happened. */
export function syncNow(): Promise<SyncOutcome> {
  if (running) return running;
  running = (async (): Promise<SyncOutcome> => {
    if (useSession.getState().status !== 'signedIn') return { sent: 0, rejected: 0, problem: 'signed-out' };
    if (!hasAccessToken() && !(await session.reconnect())) {
      const offline = !useQueue.getState().online;
      return { sent: 0, rejected: 0, problem: offline ? 'offline' : 'signed-out' };
    }
    const hadQueued = useQueue.getState().queued;
    useQueue.setState({ syncing: true });
    let sent = 0;
    let rejected = 0;
    try {
      for (let round = 0; round < 50; round++) {
        const batch = await db.queuedScans(100);
        if (!batch.length) break;
        const r = await sendBatch(batch);
        sent += r.sent;
        rejected += r.rejected;
        await refreshCounts();
      }
      await uploadPhotos();
      useQueue.setState({ online: true, lastSyncedAt: new Date().toISOString() });
      if (rejected > 0) feedback.error();
      else if (sent > 0 && hadQueued >= 5) feedback.synced();
      return { sent, rejected, problem: null };
    } catch (err) {
      if (err instanceof ApiError && err.offline) {
        useQueue.setState({ online: false });
        return { sent, rejected, problem: 'offline' };
      }
      if (err instanceof ApiError && err.status === 401) return { sent, rejected, problem: 'signed-out' };
      return { sent, rejected, problem: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' };
    } finally {
      useQueue.setState({ syncing: false });
      await refreshCounts();
      running = null;
    }
  })();
  return running;
}

async function uploadPhotos() {
  const photos = await db.queuedPhotos(20);
  for (const p of photos) {
    if (p.attempts >= 8) continue;
    try {
      const pre = await endpoints.presignPhoto({
        photoId: p.id,
        scanId: p.scanId,
        contentType: 'image/jpeg',
        sizeBytes: p.sizeBytes,
        ...(p.width ? { width: p.width } : {}),
        ...(p.height ? { height: p.height } : {}),
      });
      if (!pre.alreadyUploaded && pre.uploadUrl) await uploadPhoto(p.uri, pre.uploadUrl, pre.headers);
      await endpoints.completePhoto(p.id);
      await db.markPhoto(p.id, { status: 'uploaded', lastError: null });
      deletePhoto(p.uri);
    } catch (err) {
      if (err instanceof ApiError && err.offline) throw err;
      await db.markPhoto(p.id, { attempts: p.attempts + 1, lastError: (err as Error).message.slice(0, 200) });
    }
  }
}

/* Start up */

let started = false;

/** Watches signal and app focus, and keeps the queue moving. Call once. */
export function startSyncEngine() {
  if (started) return;
  started = true;
  void db.init().then(refreshCounts);

  Network.getNetworkStateAsync()
    .then((s) => useQueue.setState({ online: s.isInternetReachable !== false && s.isConnected !== false }))
    .catch(() => undefined);

  Network.addNetworkStateListener((s) => {
    const online = s.isInternetReachable !== false && s.isConnected !== false;
    const was = useQueue.getState().online;
    useQueue.setState({ online });
    if (online && !was) scheduleSync(800);
  });

  let last: AppStateStatus = AppState.currentState;
  AppState.addEventListener('change', (next) => {
    if (last.match(/inactive|background/) && next === 'active') scheduleSync(500);
    last = next;
  });

  setInterval(() => {
    if (useQueue.getState().queued > 0 || useQueue.getState().photos > 0) void syncNow();
  }, 45_000);

  useSession.subscribe((s, prev) => {
    if (s.status === 'signedIn' && prev.status !== 'signedIn') scheduleSync(1500);
  });
}

/** Clears local data on sign out. Only after the queue is empty or the person agreed. */
export async function wipeLocalData() {
  await db.wipe();
  await refreshCounts();
}
