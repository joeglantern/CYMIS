import type { PresenceEntry } from '@cymis/schemas';
import type { Redis } from 'ioredis';
import type { Broadcaster } from './broadcaster.js';

/** Someone counts as present if we heard from them in the last two minutes. */
const PRESENT_FOR_MS = 2 * 60 * 1000;
const key = (auditId: string) => `presence:${auditId}`;

/** Who is working on an audit right now. Stored in Redis so every API instance agrees. */
export class PresenceService {
  constructor(
    private readonly redis: Redis,
    private readonly broadcaster: Broadcaster,
  ) {}

  async list(auditId: string): Promise<PresenceEntry[]> {
    const all = await this.redis.hgetall(key(auditId));
    const now = Date.now();
    const present: PresenceEntry[] = [];
    const stale: string[] = [];
    for (const [userId, raw] of Object.entries(all)) {
      try {
        const v = JSON.parse(raw) as { fullName: string; lastSeenAt: string };
        if (now - Date.parse(v.lastSeenAt) <= PRESENT_FOR_MS) {
          present.push({ userId, fullName: v.fullName, lastSeenAt: v.lastSeenAt });
        } else {
          stale.push(userId);
        }
      } catch {
        stale.push(userId);
      }
    }
    if (stale.length > 0) await this.redis.hdel(key(auditId), ...stale);
    return present.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /** Marks someone as active. Broadcasts only when they were not already shown as present. */
  async touch(auditId: string, user: { id: string; fullName: string }): Promise<void> {
    const k = key(auditId);
    const before = await this.redis.hget(k, user.id);
    const now = new Date();
    await this.redis
      .multi()
      .hset(k, user.id, JSON.stringify({ fullName: user.fullName, lastSeenAt: now.toISOString() }))
      .expire(k, 3600)
      .exec();

    let wasPresent = false;
    if (before) {
      try {
        wasPresent = now.getTime() - Date.parse((JSON.parse(before) as { lastSeenAt: string }).lastSeenAt) <= PRESENT_FOR_MS;
      } catch {
        wasPresent = false;
      }
    }
    if (!wasPresent) await this.announce(auditId);
  }

  async leave(auditId: string, userId: string): Promise<void> {
    const removed = await this.redis.hdel(key(auditId), userId);
    if (removed > 0) await this.announce(auditId);
  }

  private async announce(auditId: string): Promise<void> {
    this.broadcaster.toAudit(auditId, 'presence:update', { auditId, present: await this.list(auditId) });
  }
}
