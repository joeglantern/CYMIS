import * as Crypto from 'expo-crypto';
import { kv } from './kv';

function randomBytes(n: number): Uint8Array {
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (g?.getRandomValues) return g.getRandomValues(new Uint8Array(n));
  return Crypto.getRandomBytes(n);
}

/**
 * UUID version 7: a millisecond timestamp then random bits. The API needs v7
 * for ids the phone makes, so scans sort by when they happened.
 */
export function uuidv7(): string {
  const bytes = randomBytes(16);
  const ms = Date.now();
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const DEVICE_KEY = 'cymis.device';

/** A random id for this install, sent with every scan so supervisors can tell phones apart. */
export function deviceId(): string {
  let id = kv.get(DEVICE_KEY);
  if (!id) {
    id = uuidv7();
    kv.set(DEVICE_KEY, id);
  }
  return id;
}
