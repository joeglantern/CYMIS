// Local and staging seed: one admin and a neutral sample facility with
// sections. Safe to run more than once. Never run against production data.

import 'dotenv/config';
import { loadEnv } from '../src/config/env.js';
import { createDb } from '../src/infra/db.js';
import { hashPassword } from '../src/modules/auth/service.js';

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
  const db = createDb(env.DATABASE_URL);

  const staffId = (process.env['SEED_ADMIN_STAFF_ID'] ?? 'ADMIN').toUpperCase();
  const password = process.env['SEED_ADMIN_PASSWORD'] ?? 'change me on first sign in';

  const admin = await db.user.upsert({
    where: { staffId },
    create: {
      staffId,
      fullName: 'System Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
    update: {},
  });

  const facility = await db.facility.upsert({
    where: { code: 'TERM1' },
    create: { code: 'TERM1', name: 'Sample Container Terminal', type: 'PORT' },
    update: {},
  });

  const sections = [
    { code: 'YB-A', name: 'Yard Block A', kind: 'YARD_BLOCK' as const, locationCodes: ['A'] },
    { code: 'YB-B', name: 'Yard Block B', kind: 'YARD_BLOCK' as const, locationCodes: ['B'] },
    { code: 'VB-1', name: 'Verification Bay 1', kind: 'VERIFICATION_BAY' as const, locationCodes: ['VB1'] },
    { code: 'GATE', name: 'Main Gate', kind: 'GATE' as const, locationCodes: [] },
  ];
  for (const s of sections) {
    await db.section.upsert({
      where: { facilityId_code: { facilityId: facility.id, code: s.code } },
      create: { ...s, facilityId: facility.id },
      update: {},
    });
  }

  console.log(`Seeded admin ${admin.staffId} and facility ${facility.code} with ${sections.length} sections.`);
  await db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
