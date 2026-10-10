import { Redis } from 'ioredis';

/**
 * General purpose client. `maxRetriesPerRequest: null` is what BullMQ needs for
 * blocking commands, and is fine for everything else here.
 */
export function createRedis(url: string, name: string): Redis {
  return new Redis(url, {
    connectionName: `cymis:${name}`,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export type { Redis };
