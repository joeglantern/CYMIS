import { describe, expect, it } from 'vitest';
import {
  ChangePasswordBody,
  ContainerNumber,
  ContainerNumberLoose,
  LoginBody,
  Password,
  ReviewScanBody,
  StaffId,
  SyncScansBody,
} from './index.js';

const uuidv7 = '0192f1a4-7b3c-7def-8abc-0123456789ab';
const uuidv4 = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('ContainerNumber', () => {
  it('normalises and accepts a valid number', () => {
    expect(ContainerNumber.parse('csqu 305438-3')).toBe('CSQU3054383');
  });
  it('rejects a bad check digit', () => {
    expect(ContainerNumber.safeParse('CSQU3054384').success).toBe(false);
  });
  it('loose version accepts a bad check digit but not a bad shape', () => {
    expect(ContainerNumberLoose.parse('CSQU3054384')).toBe('CSQU3054384');
    expect(ContainerNumberLoose.safeParse('CSQ3054384').success).toBe(false);
  });
});

describe('StaffId and Password', () => {
  it('uppercases staff ids and blocks odd characters', () => {
    expect(StaffId.parse(' ab123 ')).toBe('AB123');
    expect(StaffId.safeParse('ab 123').success).toBe(false);
    expect(StaffId.safeParse("ab'; drop").success).toBe(false);
  });
  it('needs 10 characters and some variety', () => {
    expect(Password.safeParse('short').success).toBe(false);
    expect(Password.safeParse('aaaaaaaaaaaa').success).toBe(false);
    expect(Password.safeParse('yard crew 2026').success).toBe(true);
  });
  it('login defaults to mobile', () => {
    expect(LoginBody.parse({ staffId: 'x1', password: 'p' }).client).toBe('mobile');
  });
  it('new password must differ', () => {
    expect(ChangePasswordBody.safeParse({ currentPassword: 'yard crew 2026', newPassword: 'yard crew 2026' }).success).toBe(false);
  });
});

describe('SyncScansBody', () => {
  const scan = {
    id: uuidv7,
    auditId: uuidv4,
    containerNumber: 'CSQU3054383',
    entryMethod: 'OCR',
    capturedAt: '2026-10-20T08:30:00.000Z',
    deviceId: 'phone-1',
  };

  it('accepts a minimal scan', () => {
    expect(SyncScansBody.safeParse({ scans: [scan] }).success).toBe(true);
  });
  it('needs a UUIDv7 scan id', () => {
    expect(SyncScansBody.safeParse({ scans: [{ ...scan, id: uuidv4 }] }).success).toBe(false);
  });
  it('caps a batch at 100', () => {
    const many = Array.from({ length: 101 }, () => scan);
    expect(SyncScansBody.safeParse({ scans: many }).success).toBe(false);
  });
  it('rejects an empty batch and a bad date', () => {
    expect(SyncScansBody.safeParse({ scans: [] }).success).toBe(false);
    expect(SyncScansBody.safeParse({ scans: [{ ...scan, capturedAt: 'yesterday' }] }).success).toBe(false);
  });
});

describe('ReviewScanBody', () => {
  it('needs a correction when correcting', () => {
    expect(ReviewScanBody.safeParse({ action: 'CORRECT' }).success).toBe(false);
    expect(ReviewScanBody.safeParse({ action: 'CORRECT', correctedColour: 'red' }).success).toBe(true);
  });
  it('needs a note when rejecting', () => {
    expect(ReviewScanBody.safeParse({ action: 'REJECT' }).success).toBe(false);
    expect(ReviewScanBody.safeParse({ action: 'REJECT', note: 'Photo is of the wrong box' }).success).toBe(true);
  });
});
