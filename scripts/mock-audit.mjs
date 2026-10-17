// Creates a running audit from a small list, for testing the scanner.
//
//   MOCK_API_URL=https://... MOCK_STAFF_ID=ADMIN MOCK_PASSWORD=... node scripts/mock-audit.mjs list.json
//
// list.json: { "name": "...", "sectionCode": "YB-A", "containers": [{ "containerNumber", "sizeType", "location" }] }
// Signs in as an admin or supervisor, creates the audit, uploads the list as a
// CSV, maps and commits it, assigns every active crew member, and starts it.

import { readFileSync } from 'node:fs';

const API = `${process.env.MOCK_API_URL ?? 'http://127.0.0.1:4000'}/api/v1`;
const list = JSON.parse(readFileSync(process.argv[2], 'utf8'));

async function call(path, { token, method, body, form } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body || form ? 'POST' : 'GET'),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method ?? 'GET'} ${path} ${res.status}: ${data?.error?.message ?? text}`);
  return data;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ok) {
  for (let i = 0; i < 120; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await wait(500);
  }
  throw new Error('Timed out waiting for the import');
}

const login = await call('/auth/login', {
  body: { staffId: process.env.MOCK_STAFF_ID ?? 'ADMIN', password: process.env.MOCK_PASSWORD, client: 'mobile' },
});
const token = login.accessToken;

const facilities = await call('/facilities', { token });
const sections = facilities.flatMap((f) => f.sections);
const section = sections.find((s) => s.code === list.sectionCode) ?? sections.find((s) => s.isActive);
if (!section) throw new Error('No section to put the audit in');

const audit = await call('/audits', { token, body: { sectionId: section.id, name: list.name, notes: 'Made for testing the scanner' } });

const rows = ['Container No,Size Type,Location', ...list.containers.map((c) => `${c.containerNumber},${c.sizeType},${c.location}`)];
const form = new FormData();
form.append('file', new Blob([rows.join('\n')], { type: 'text/csv' }), 'scan-test.csv');
let imp = await call(`/imports?auditId=${audit.id}`, { token, form });
imp = await until(() => call(`/imports/${imp.id}`, { token }), (i) => i.status === 'READY' || i.status === 'FAILED');
if (imp.status === 'FAILED') throw new Error(`Import failed: ${imp.failureReason}`);
await call(`/imports/${imp.id}/mapping`, { token, body: { mapping: { containerNumber: 'Container No', sizeType: 'Size Type', location: 'Location' }, mode: 'replace' } });
await until(() => call(`/imports/${imp.id}`, { token }), (i) => i.validated);
await call(`/imports/${imp.id}/commit`, { token, body: {} });
imp = await until(() => call(`/imports/${imp.id}`, { token }), (i) => i.status === 'COMMITTED');

const crew = (await call('/users?role=AUDITOR&active=true&limit=200', { token })).items.map((u) => u.id);
if (crew.length) await call(`/audits/${audit.id}/assignees`, { token, method: 'PUT', body: { userIds: crew } });
await call(`/audits/${audit.id}/start`, { token, body: {} });

console.log(`Started "${list.name}" in ${section.name} with ${imp.validCount} expected containers.`);
