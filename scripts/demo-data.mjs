// Fills a local API with believable demo data: a supervisor, three crew, a
// live audit with an expected list, and a draft audit. Safe to run twice.
//
//   node scripts/demo-data.mjs
//
// Reads apps/api/.env for the seeded admin, and these optional settings:
//   DEMO_API_URL       default http://127.0.0.1:4000
//   DEMO_PASSWORD      password given to every demo account (see apps/api/.env.example)

import { readFileSync } from 'node:fs';
import { computeCheckDigit } from '../packages/iso6346/dist/index.js';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // No .env, fall back to defaults.
  }
}
loadEnv(new URL('../apps/api/.env', import.meta.url));

const API = `${process.env.DEMO_API_URL ?? 'http://127.0.0.1:4000'}/api/v1`;
const SEED_ID = process.env.SEED_ADMIN_STAFF_ID ?? 'ADMIN';
const SEED_PW = process.env.SEED_ADMIN_PASSWORD ?? 'change me on first sign in';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'yard crew demo 2026';

async function call(path, { token, method, body, form } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body || form ? 'POST' : 'GET'),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method ?? 'GET'} ${path} ${res.status}: ${data?.error?.message ?? text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Signs in, and sets the demo password if the account still has a temporary one. */
async function signIn(staffId, ...passwords) {
  for (const pw of passwords) {
    try {
      const res = await call('/auth/login', { body: { staffId, password: pw, client: 'mobile' } });
      if (!res.user.mustChangePassword) return res.accessToken;
      const changed = await call('/auth/change-password', {
        token: res.accessToken,
        body: { currentPassword: pw, newPassword: PASSWORD, client: 'mobile' },
      });
      return changed.accessToken;
    } catch (err) {
      if (err.status !== 401) throw err;
    }
  }
  throw new Error(`Could not sign in as ${staffId}`);
}

function containerNumber(owner, serial) {
  const first10 = `${owner}${String(serial).padStart(6, '0')}`;
  return `${first10}${computeCheckDigit(first10)}`;
}

const PEOPLE = [
  { staffId: 'GAC101', fullName: 'Grace Achieng', role: 'SUPERVISOR' },
  { staffId: 'AMW204', fullName: 'Amina Wanjiru', role: 'AUDITOR' },
  { staffId: 'OKM118', fullName: 'Otieno Kamau', role: 'AUDITOR' },
  { staffId: 'HMW330', fullName: 'Hassan Mwinyi', role: 'AUDITOR' },
];

const admin = await signIn(SEED_ID, PASSWORD, SEED_PW);
console.log('Signed in as admin');

const existing = (await call('/users?limit=200', { token: admin })).items;
const ids = {};
for (const p of PEOPLE) {
  let user = existing.find((u) => u.staffId === p.staffId);
  if (!user) {
    user = await call('/users', { token: admin, body: { ...p, temporaryPassword: `${PASSWORD} first` } });
    console.log(`Added ${p.fullName}`);
  }
  ids[p.staffId] = user.id;
  try {
    await signIn(p.staffId, PASSWORD, `${PASSWORD} first`);
  } catch {
    // Someone changed it while testing. Put the demo password back.
    await call(`/users/${user.id}/unlock`, { token: admin, body: {} }).catch(() => undefined);
    await call(`/users/${user.id}/reset-password`, { token: admin, body: { temporaryPassword: `${PASSWORD} reset` } });
    await signIn(p.staffId, `${PASSWORD} reset`);
    console.log(`Restored ${p.fullName}`);
  }
}

const facilities = await call('/facilities', { token: admin });
const section = facilities.flatMap((f) => f.sections).find((s) => s.isActive);
if (!section) throw new Error('No section found. Run the seed first.');

const audits = (await call('/audits?limit=100', { token: admin })).items;
let live = audits.find((a) => a.name === 'Block A morning count' && a.status !== 'CANCELLED');

if (!live) {
  live = await call('/audits', { token: admin, body: { sectionId: section.id, name: 'Block A morning count', notes: 'Demo audit' } });
  const owners = ['MSKU', 'CSQU', 'TGHU', 'HLXU', 'OOLU', 'MAEU', 'TCNU', 'GESU'];
  const prefix = section.locationCodes?.[0] ?? 'A';
  const rows = ['Container No,Size Type,Location,Vessel,F/E'];
  for (let i = 0; i < 160; i++) {
    const n = containerNumber(owners[i % owners.length], 300000 + i * 37);
    const row = `${prefix}0${1 + Math.floor(i / 27)}-${String(1 + (i % 12)).padStart(2, '0')}-${1 + (i % 4)}`;
    rows.push(`${n},${i % 3 ? '45G1' : '22G1'},${row},MSC DEMO,${i % 5 ? 'F' : 'E'}`);
  }
  const form = new FormData();
  form.append('file', new Blob([rows.join('\n')], { type: 'text/csv' }), 'block-a-export.csv');
  let imp = await call(`/imports?auditId=${live.id}`, { token: admin, form });
  for (let i = 0; i < 60 && imp.status !== 'READY' && imp.status !== 'FAILED'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    imp = await call(`/imports/${imp.id}`, { token: admin });
  }
  if (imp.status === 'FAILED') throw new Error(`Import failed: ${imp.failureReason}`);
  const mapping = { containerNumber: 'Container No', sizeType: 'Size Type', location: 'Location', vessel: 'Vessel', fullEmpty: 'F/E' };
  imp = await call(`/imports/${imp.id}/mapping`, { token: admin, body: { mapping, mode: 'replace' } });
  for (let i = 0; i < 60 && !imp.validated; i++) {
    await new Promise((r) => setTimeout(r, 500));
    imp = await call(`/imports/${imp.id}`, { token: admin });
  }
  imp = await call(`/imports/${imp.id}/commit`, { token: admin, body: {} });
  for (let i = 0; i < 60 && imp.status !== 'COMMITTED'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    imp = await call(`/imports/${imp.id}`, { token: admin });
  }
  console.log(`Imported ${imp.validCount} expected containers`);
  await call(`/audits/${live.id}/assignees`, { token: admin, method: 'PUT', body: { userIds: [ids.AMW204, ids.OKM118, ids.HMW330] } });
  await call(`/audits/${live.id}/start`, { token: admin, body: {} });
  console.log('Started Block A morning count');
}

if (!audits.some((a) => a.name === 'Verification Bay 1')) {
  const bay = facilities.flatMap((f) => f.sections).find((s) => s.kind === 'VERIFICATION_BAY') ?? section;
  const draft = await call('/audits', { token: admin, body: { sectionId: bay.id, name: 'Verification Bay 1' } });
  await call(`/audits/${draft.id}/assignees`, { token: admin, method: 'PUT', body: { userIds: [ids.AMW204] } });
  console.log('Added draft Verification Bay 1');
}

console.log('Demo data ready. Accounts: ADMIN, GAC101 (supervisor), AMW204, OKM118, HMW330 (crew). Password is DEMO_PASSWORD.');
