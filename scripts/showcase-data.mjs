// Fills a test server with a believable day in the yard, for screenshots and
// demos: three crew part way through a big block count, a count closed
// yesterday, a draft for later, and a few scans waiting for review.
//
//   SHOW_API_URL=https://... SHOW_ADMIN_PASSWORD=... SHOW_CREW_PASSWORD=... node scripts/showcase-data.mjs
//
// Safe to run twice: people and audits that already exist are reused.

import { computeCheckDigit } from '../packages/iso6346/dist/index.js';

const API = `${process.env.SHOW_API_URL ?? 'http://127.0.0.1:4000'}/api/v1`;
const ADMIN_PW = process.env.SHOW_ADMIN_PASSWORD;
const CREW_PW = process.env.SHOW_CREW_PASSWORD;
if (!ADMIN_PW || !CREW_PW) throw new Error('Set SHOW_ADMIN_PASSWORD and SHOW_CREW_PASSWORD');

let seed = 20261023;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, { token, method, body, form } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method: method ?? (body || form ? 'POST' : 'GET'),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: form ?? (body ? JSON.stringify(body) : undefined),
      });
    } catch {
      // The tunnel drops a connection now and then. Scan sync is safe to repeat.
      console.log(`network hiccup on ${path}, retrying`);
      await wait(4000);
      continue;
    }
    if (res.status === 429) {
      await wait(15000);
      continue;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(`${method ?? 'GET'} ${path} ${res.status}: ${data?.error?.message ?? text}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  throw new Error(`Rate limited too long on ${path}`);
}

async function signIn(staffId, ...passwords) {
  for (const pw of passwords) {
    try {
      const res = await call('/auth/login', { body: { staffId, password: pw, client: 'mobile' } });
      if (!res.user.mustChangePassword) return res;
      return await call('/auth/change-password', { token: res.accessToken, body: { currentPassword: pw, newPassword: CREW_PW, client: 'mobile' } });
    } catch (err) {
      if (err.status !== 401) throw err;
    }
  }
  throw new Error(`Could not sign in as ${staffId}`);
}

const number = (owner, serial) => {
  const head = `${owner}${String(serial).padStart(6, '0')}`;
  return `${head}${computeCheckDigit(head)}`;
};
const owners = ['MSKU', 'MAEU', 'CMAU', 'HLXU', 'OOLU', 'TGHU', 'CSQU', 'MSCU', 'TCNU', 'GESU', 'SEGU', 'FCIU', 'BEAU', 'TRLU', 'ONEU', 'EGHU'];
const colours = ['black', 'black', 'grey', 'grey', 'blue', 'blue', 'red', 'white', 'green', 'maroon', 'orange', 'brown'];

function expectedList(prefix, rows, bays, count, startSerial) {
  const list = [];
  const perRow = Math.ceil(count / rows);
  for (let i = 0; i < count; i++) {
    const row = 1 + Math.floor(i / perRow);
    const idx = i % perRow;
    const bay = 1 + Math.floor((idx * bays) / perRow);
    const tier = 1 + (idx % 4);
    list.push({
      containerNumber: number(owners[i % owners.length], startSerial + i * 73),
      sizeType: pick(['45G1', '45G1', '22G1', '42G1', '45R1']),
      location: `${prefix}${String(row).padStart(2, '0')}-${String(bay).padStart(2, '0')}-${tier}`,
      vessel: pick(['MSC AURORA', 'MAERSK KENSINGTON', 'CMA CGM TANA', 'ONE MOMBASA']),
      fullEmpty: rnd() > 0.2 ? 'F' : 'E',
    });
  }
  return list;
}

async function createAudit(token, sectionId, name, list) {
  const audit = await call('/audits', { token, body: { sectionId, name } });
  const rows = ['Container No,Size Type,Location,Vessel,F/E', ...list.map((c) => `${c.containerNumber},${c.sizeType},${c.location},${c.vessel},${c.fullEmpty}`)];
  const form = new FormData();
  form.append('file', new Blob([rows.join('\n')], { type: 'text/csv' }), 'terminal-export.csv');
  let imp = await call(`/imports?auditId=${audit.id}`, { token, form });
  for (let i = 0; i < 240 && imp.status !== 'READY' && imp.status !== 'FAILED'; i++) {
    await wait(500);
    imp = await call(`/imports/${imp.id}`, { token });
  }
  await call(`/imports/${imp.id}/mapping`, {
    token,
    body: { mapping: { containerNumber: 'Container No', sizeType: 'Size Type', location: 'Location', vessel: 'Vessel', fullEmpty: 'F/E' }, mode: 'replace' },
  });
  for (let i = 0; i < 240 && !imp.validated; i++) {
    await wait(500);
    imp = await call(`/imports/${imp.id}`, { token });
  }
  await call(`/imports/${imp.id}/commit`, { token, body: {} });
  for (let i = 0; i < 240 && imp.status !== 'COMMITTED'; i++) {
    await wait(500);
    imp = await call(`/imports/${imp.id}`, { token });
  }
  return audit;
}

function uuidv7(ms) {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[0] = Math.floor(ms / 2 ** 40) & 255; b[1] = Math.floor(ms / 2 ** 32) & 255; b[2] = Math.floor(ms / 2 ** 24) & 255;
  b[3] = Math.floor(ms / 2 ** 16) & 255; b[4] = Math.floor(ms / 2 ** 8) & 255; b[5] = ms & 255;
  b[6] = (b[6] & 15) | 112; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function syncAll(token, items) {
  for (let i = 0; i < items.length; i += 100) await call('/sync/scans', { token, body: { scans: items.slice(i, i + 100) } });
}

// Around the Kilindini yards, so the map pins land somewhere believable.
const near = () => ({ lat: -4.0435 + (rnd() - 0.5) * 0.004, lng: 39.6682 + (rnd() - 0.5) * 0.004, accuracyM: Math.round(3 + rnd() * 6) });

function scansFor(auditId, list, { count, unexpected, badDigits, start, end, deviceId }) {
  const items = [];
  const span = end - start;
  const chosen = list.slice(0, count);
  chosen.forEach((c, i) => {
    const at = start + Math.round((span * i) / Math.max(1, chosen.length)) + Math.round(rnd() * 20000);
    items.push({
      id: uuidv7(at), auditId, containerNumber: c.containerNumber, entryMethod: rnd() > 0.12 ? 'OCR' : 'OCR_CORRECTED',
      capturedAt: new Date(at).toISOString(), location: near(), colourChosen: pick(colours), deviceId, ocrConfidence: Math.round((0.86 + rnd() * 0.13) * 100) / 100,
    });
  });
  for (let i = 0; i < unexpected; i++) {
    const at = start + Math.round(rnd() * span);
    items.push({ id: uuidv7(at), auditId, containerNumber: number(pick(owners), 800000 + Math.floor(rnd() * 99999)), entryMethod: 'OCR', capturedAt: new Date(at).toISOString(), location: near(), colourChosen: pick(colours), deviceId });
  }
  for (let i = 0; i < badDigits; i++) {
    const at = start + Math.round(rnd() * span);
    const good = list[count + 40 + i].containerNumber;
    const bad = good.slice(0, 10) + ((Number(good[10]) + 3) % 10);
    items.push({ id: uuidv7(at), auditId, containerNumber: bad, entryMethod: 'MANUAL', capturedAt: new Date(at).toISOString(), location: near(), colourChosen: pick(colours), deviceId });
  }
  return items.sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : 1));
}

// People
const admin = (await signIn('ADMIN', ADMIN_PW)).accessToken;
const PEOPLE = [
  { staffId: 'GAC101', fullName: 'Grace Achieng', role: 'SUPERVISOR' },
  { staffId: 'AMW204', fullName: 'Amina Wanjiru', role: 'AUDITOR' },
  { staffId: 'OKM118', fullName: 'Otieno Kamau', role: 'AUDITOR' },
  { staffId: 'HMW330', fullName: 'Hassan Mwinyi', role: 'AUDITOR' },
  { staffId: 'FNJ412', fullName: 'Faith Njeri', role: 'AUDITOR' },
];
const existing = (await call('/users?limit=200', { token: admin })).items;
const ids = {};
const tokens = {};
for (const p of PEOPLE) {
  let u = existing.find((x) => x.staffId === p.staffId);
  if (!u) u = await call('/users', { token: admin, body: { ...p, temporaryPassword: `${CREW_PW} first` } });
  ids[p.staffId] = u.id;
  try {
    tokens[p.staffId] = (await signIn(p.staffId, CREW_PW, `${CREW_PW} first`)).accessToken;
  } catch {
    await call(`/users/${u.id}/reset-password`, { token: admin, body: { temporaryPassword: `${CREW_PW} reset` } });
    tokens[p.staffId] = (await signIn(p.staffId, `${CREW_PW} reset`)).accessToken;
  }
}
const sup = tokens.GAC101;
console.log('People ready');

const facilities = await call('/facilities', { token: admin });
const sections = facilities.flatMap((f) => f.sections);
const ybA = sections.find((s) => s.code === 'YB-A');
const ybB = sections.find((s) => s.code === 'YB-B');
const vb1 = sections.find((s) => s.code === 'VB-1');
const audits = (await call('/audits?limit=100', { token: admin })).items;
const now = Date.now();
const today = new Date();
today.setHours(8, 10, 0, 0);

// Yesterday's closed count in Block B
if (!audits.some((a) => a.name === 'Block B evening count')) {
  const list = expectedList('B', 8, 12, 412, 210000);
  const audit = await createAudit(sup, ybB.id, 'Block B evening count', list);
  await call(`/audits/${audit.id}/assignees`, { token: sup, method: 'PUT', body: { userIds: [ids.AMW204, ids.OKM118] } });
  await call(`/audits/${audit.id}/start`, { token: sup, body: {} });
  const y0 = today.getTime() - 15 * 3600_000;
  await syncAll(tokens.AMW204, scansFor(audit.id, list.slice(0, 200), { count: 196, unexpected: 3, badDigits: 0, start: y0, end: y0 + 2.5 * 3600_000, deviceId: 'phone-amina' }));
  await syncAll(tokens.OKM118, scansFor(audit.id, list.slice(200), { count: 203, unexpected: 2, badDigits: 0, start: y0, end: y0 + 2.6 * 3600_000, deviceId: 'phone-otieno' }));
  await call(`/audits/${audit.id}/close`, { token: sup, body: {} });
  console.log('Closed Block B evening count');
}

// Today's live count in Block A
if (!audits.some((a) => a.name === 'Block A morning count' && a.status === 'ACTIVE' && a.counts.expected > 1000)) {
  const list = expectedList('A', 6, 12, 1284, 300000);
  const audit = await createAudit(sup, ybA.id, 'Block A morning count', list);
  await call(`/audits/${audit.id}/assignees`, { token: sup, method: 'PUT', body: { userIds: [ids.AMW204, ids.OKM118, ids.HMW330] } });
  await call(`/audits/${audit.id}/start`, { token: sup, body: {} });
  const end = Math.min(now - 60_000, today.getTime() + 3.6 * 3600_000);
  const start = Math.min(today.getTime(), end - 3 * 3600_000);
  const thirds = [list.slice(0, 460), list.slice(460, 900), list.slice(900)];
  await syncAll(tokens.AMW204, scansFor(audit.id, thirds[0], { count: 412, unexpected: 9, badDigits: 4, start, end, deviceId: 'phone-amina' }));
  await syncAll(tokens.OKM118, scansFor(audit.id, thirds[1], { count: 388, unexpected: 8, badDigits: 3, start, end, deviceId: 'phone-otieno' }));
  await syncAll(tokens.HMW330, scansFor(audit.id, thirds[2], { count: 322, unexpected: 5, badDigits: 2, start, end: end - 20 * 60_000, deviceId: 'phone-hassan' }));
  console.log('Block A morning count is live');
}

if (!audits.some((a) => a.name === 'Verification Bay 1, afternoon')) {
  const draft = await call('/audits', { token: sup, body: { sectionId: vb1.id, name: 'Verification Bay 1, afternoon' } });
  await call(`/audits/${draft.id}/assignees`, { token: sup, method: 'PUT', body: { userIds: [ids.AMW204, ids.FNJ412] } });
  console.log('Draft for the afternoon added');
}
console.log('Showcase data ready');
