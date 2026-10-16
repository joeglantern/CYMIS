import type { AuditCounts, ClientToServerEvents, JoinAck, PresenceEntry, ScanDto, ServerToClientEvents } from '@cymis/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/api/http';
import { hasAccessToken, useSession } from '@/auth/session';
import { keys } from '@/api/queries';

// Sockets only carry news. Scans travel over REST so offline sync and live
// updates never fight. One socket per app, joined to the audits on screen.

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let getToken: () => Promise<string | null> = async () => null;

export function configureSocket(tokenGetter: () => Promise<string | null>) {
  getToken = tokenGetter;
}

function connect(): AppSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ['websocket'],
    autoConnect: false,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    // Token goes in the handshake body, never the URL.
    auth: (cb) => {
      getToken()
        .then((token) => cb({ token }))
        .catch(() => cb({}));
    },
  });
  socket.on('connect_error', (err) => {
    // Expired token: the next attempt asks for a fresh one through auth().
    if (err.message === 'token_expired' || err.message === 'unauthorized') {
      setTimeout(() => socket?.connect(), 1500);
    }
  });
  return socket;
}

export function startRealtime() {
  const s = connect();
  const apply = (status: string) => {
    if (status === 'signedIn' && hasAccessToken()) {
      if (!s.connected) s.connect();
    } else if (s.connected) {
      s.disconnect();
    }
  };
  apply(useSession.getState().status);
  useSession.subscribe((st) => apply(st.status));
}

export function getSocket(): AppSocket | null {
  return socket;
}

/** Applies live events for one audit straight into the query cache. */
export function useAuditRoom(auditId: string | null | undefined, qc: QueryClient) {
  const [present, setPresent] = useState<PresenceEntry[]>([]);
  const [connected, setConnected] = useState(socket?.connected ?? false);

  useEffect(() => {
    if (!auditId) return;
    const s = connect();

    const join = () => {
      s.emit('audit:join', { auditId }, (ack: JoinAck) => {
        if (ack.ok) {
          setPresent(ack.present);
          qc.setQueryData(keys.progress(auditId), ack.counts);
        }
      });
    };

    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);
    const onProgress = (p: { auditId: string; counts: AuditCounts }) => {
      if (p.auditId === auditId) qc.setQueryData(keys.progress(auditId), p.counts);
    };
    const onScan = (p: { auditId: string; scan: ScanDto }) => {
      if (p.auditId !== auditId) return;
      void qc.invalidateQueries({ queryKey: keys.scans(auditId) });
    };
    const onPresence = (p: { auditId: string; present: PresenceEntry[] }) => {
      if (p.auditId === auditId) setPresent(p.present);
    };
    const onStatus = (p: { auditId: string }) => {
      if (p.auditId === auditId) void qc.invalidateQueries({ queryKey: keys.audit(auditId) });
    };
    const onFlag = (p: { auditId: string }) => {
      if (p.auditId === auditId) void qc.invalidateQueries({ queryKey: keys.review() });
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('audit:progress', onProgress);
    s.on('scan:created', onScan);
    s.on('scan:updated', onScan);
    s.on('presence:update', onPresence);
    s.on('audit:status', onStatus);
    s.on('flag:raised', onFlag);
    if (s.connected) join();
    else if (useSession.getState().status === 'signedIn') s.connect();

    return () => {
      s.emit('audit:leave', { auditId });
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('audit:progress', onProgress);
      s.off('scan:created', onScan);
      s.off('scan:updated', onScan);
      s.off('presence:update', onPresence);
      s.off('audit:status', onStatus);
      s.off('flag:raised', onFlag);
    };
  }, [auditId, qc]);

  return { present, connected };
}

/** Tells the room this person is scanning, every 30 seconds while the scanner is open. */
export function usePresenceHeartbeat(auditId: string | null | undefined, active: boolean) {
  useEffect(() => {
    if (!auditId || !active) return;
    const beat = () => socket?.connected && socket.emit('presence:heartbeat', { auditId });
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [auditId, active]);
}
