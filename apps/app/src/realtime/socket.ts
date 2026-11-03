import type { AuditCounts, ClientToServerEvents, JoinAck, PresenceEntry, ScanDto, ServerToClientEvents } from '@cymis/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/api/http';
import { hasAccessToken, useSession } from '@/auth/session';
import { keys } from '@/api/queries';

/** A burst of scans refreshes the bay grid and map at most this often, however fast the news comes. */
const MAP_REFRESH_MS = 4_000;

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

    let refreshing: ReturnType<typeof setTimeout> | null = null;
    const refreshMaps = () => {
      if (refreshing) return;
      refreshing = setTimeout(() => {
        refreshing = null;
        void qc.invalidateQueries({ queryKey: keys.bays(auditId) });
        void qc.invalidateQueries({ queryKey: keys.yardMap(auditId) });
      }, MAP_REFRESH_MS);
    };

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
      // Anything may have happened while the socket was down.
      refreshMaps();
    };
    const onDisconnect = () => setConnected(false);
    const onProgress = (p: { auditId: string; counts: AuditCounts }) => {
      if (p.auditId !== auditId) return;
      qc.setQueryData(keys.progress(auditId), p.counts);
      refreshMaps();
    };
    const onExpected = (p: { auditId: string }) => {
      if (p.auditId === auditId) refreshMaps();
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
    s.on('expected:updated', onExpected);
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
      if (refreshing) clearTimeout(refreshing);
      s.off('audit:progress', onProgress);
      s.off('expected:updated', onExpected);
      s.off('scan:created', onScan);
      s.off('scan:updated', onScan);
      s.off('presence:update', onPresence);
      s.off('audit:status', onStatus);
      s.off('flag:raised', onFlag);
    };
  }, [auditId, qc]);

  return { present, connected };
}

/**
 * Tells the room this person is scanning, every 30 seconds while the scanner is
 * open, and that they stopped when it closes. Only the scanner does this, so
 * "scanning" stays true: someone looking at a plan never shows as working on it.
 */
export function usePresenceHeartbeat(auditId: string | null | undefined, active: boolean) {
  useEffect(() => {
    if (!auditId || !active) return;
    const s = socket;
    // The server only hears someone in the room, and a reconnect or a direct link leaves them outside it.
    const beat = () => {
      if (s?.connected) s.emit('audit:join', { auditId }, () => s.emit('presence:heartbeat', { auditId }));
    };
    beat();
    s?.on('connect', beat);
    const t = setInterval(beat, 30_000);
    return () => {
      clearInterval(t);
      s?.off('connect', beat);
    };
  }, [auditId, active]);

  // Pausing to confirm a scan is still scanning. Closing the scanner is not.
  useEffect(() => {
    if (!auditId) return;
    return () => {
      if (socket?.connected) socket.emit('presence:stopped', { auditId });
    };
  }, [auditId]);
}
