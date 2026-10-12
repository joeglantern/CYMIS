import { Emitter } from '@socket.io/redis-emitter';
import type { ServerToClientEvents } from '@cymis/schemas';
import type { Redis } from 'ioredis';

export const rooms = {
  audit: (auditId: string) => `audit:${auditId}`,
  user: (userId: string) => `user:${userId}`,
  supervisors: 'role:supervisor',
} as const;

type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Sends live events to connected clients. It publishes through Redis, so it
 * works the same from the API process and from the background worker, and
 * reaches clients on every API instance.
 */
export class Broadcaster {
  private readonly emitter: Emitter<ServerToClientEvents>;

  constructor(redis: Redis) {
    this.emitter = new Emitter<ServerToClientEvents>(redis);
  }

  toAudit<E extends EventName>(auditId: string, event: E, payload: Payload<E>): void {
    // The emitter's typed signature uses tuple params; cast keeps call sites simple.
    (this.emitter.to(rooms.audit(auditId)) as unknown as { emit: (e: E, p: Payload<E>) => void }).emit(
      event,
      payload,
    );
  }

  toUser<E extends EventName>(userId: string, event: E, payload: Payload<E>): void {
    (this.emitter.to(rooms.user(userId)) as unknown as { emit: (e: E, p: Payload<E>) => void }).emit(event, payload);
  }

  toSupervisors<E extends EventName>(event: E, payload: Payload<E>): void {
    (this.emitter.to(rooms.supervisors) as unknown as { emit: (e: E, p: Payload<E>) => void }).emit(event, payload);
  }

  /** Drops every live connection for a user, for example after they are deactivated. */
  disconnectUser(userId: string): void {
    this.emitter.in(rooms.user(userId)).disconnectSockets(true);
  }
}
