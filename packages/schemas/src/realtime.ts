// Socket.IO event contract. Scans are sent over REST; sockets only carry
// broadcasts and room joins. Both the server and the apps type their sockets
// with these interfaces.

import type { AuditCounts } from './audits.js';
import type { AuditStatus, ImportStatus, ReportStatus } from './enums.js';
import type { ScanDto } from './scans.js';

export interface PresenceEntry {
  userId: string;
  fullName: string;
  /** When we last saw a scan or a heartbeat from them. */
  lastSeenAt: string;
}

export interface ServerToClientEvents {
  'scan:created': (payload: { auditId: string; scan: ScanDto }) => void;
  'scan:updated': (payload: { auditId: string; scan: ScanDto }) => void;
  'audit:progress': (payload: { auditId: string; counts: AuditCounts; at: string }) => void;
  'audit:status': (payload: { auditId: string; status: AuditStatus; at: string }) => void;
  'expected:updated': (payload: { auditId: string; listVersion: number }) => void;
  'presence:update': (payload: { auditId: string; present: PresenceEntry[] }) => void;
  'flag:raised': (payload: { auditId: string; scanId: string; flags: string[] }) => void;
  'import:status': (payload: { importId: string; auditId: string; status: ImportStatus; validated: boolean }) => void;
  'report:ready': (payload: { reportId: string; auditId: string; status: ReportStatus }) => void;
}

export type JoinAck =
  | { ok: true; auditId: string; counts: AuditCounts; listVersion: number; present: PresenceEntry[] }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  'audit:join': (payload: { auditId: string }, ack: (res: JoinAck) => void) => void;
  'audit:leave': (payload: { auditId: string }) => void;
  /** Sent every 30 seconds or so while the scanner screen is open. */
  'presence:heartbeat': (payload: { auditId: string }) => void;
}

export const SOCKET_ERRORS = {
  unauthorized: 'unauthorized',
  tokenExpired: 'token_expired',
} as const;
