import { isValidContainerNumber, normalise } from '@cymis/iso6346';
import { hostname } from 'node:os';
import type { FastifyBaseLogger as Logger } from 'fastify';
import type { AppContext } from '../context.js';
import type { ScanFlag } from '../infra/db.js';
import { createRedis, type Redis } from '../infra/redis.js';
import { CvResult, GROUPS, STREAMS } from '../infra/streams.js';
import { scanInclude, toScanDto } from '../lib/dto.js';

/** How sure the server must be before it disagrees with the crew. */
export const OCR_MISMATCH_CONFIDENCE = 0.8;
export const COLOUR_MISMATCH_CONFIDENCE = 0.6;
const MAX_DELIVERIES = 5;
const RECLAIM_IDLE_MS = 60_000;

type StreamEntry = [id: string, fields: string[]];

/** Applies one CV result to its scan. Safe to run twice for the same result. */
export async function applyCvResult(ctx: AppContext, result: CvResult): Promise<void> {
  const scan = await ctx.db.scan.findUnique({ where: { id: result.scanId } });
  if (!scan) return;

  if (result.thumbKey) {
    await ctx.db.photo.updateMany({ where: { id: result.photoId, scanId: scan.id }, data: { thumbKey: result.thumbKey } });
  }

  const flags = new Set<ScanFlag>(scan.flags);
  const before = flags.size;

  if (result.ok) {
    const ocr = result.ocr ?? null;
    if (ocr && ocr.confidence >= OCR_MISMATCH_CONFIDENCE) {
      const read = normalise(ocr.number);
      if (isValidContainerNumber(read) && read !== scan.containerNumber) flags.add('NUMBER_MISMATCH');
    }
    const colour = result.colour ?? null;
    if (colour && scan.colourChosen && colour.confidence >= COLOUR_MISMATCH_CONFIDENCE && colour.name !== scan.colourChosen) {
      flags.add('COLOUR_MISMATCH');
    }
  }

  const raised = flags.size > before;
  const updated = await ctx.db.scan.update({
    where: { id: scan.id },
    data: {
      cvStatus: result.ok ? 'DONE' : 'FAILED',
      ...(result.ok
        ? {
            colourSuggested: result.colour?.name ?? null,
            colourHex: result.colour?.hex ?? null,
            colourConfidence: result.colour?.confidence ?? null,
            serverOcrNumber: result.ocr ? normalise(result.ocr.number) : null,
            serverOcrConfidence: result.ocr?.confidence ?? null,
          }
        : {}),
      flags: [...flags],
      // A flag only sends it for review if nobody has reviewed it yet.
      ...(raised && scan.reviewStatus === 'NONE' ? { reviewStatus: 'PENDING' as const } : {}),
    },
    include: scanInclude,
  });

  const dto = toScanDto(updated);
  ctx.broadcaster.toAudit(scan.auditId, 'scan:updated', { auditId: scan.auditId, scan: dto });
  if (raised) ctx.broadcaster.toAudit(scan.auditId, 'flag:raised', { auditId: scan.auditId, scanId: scan.id, flags: dto.flags });
  ctx.progress.schedule(scan.auditId);
}

function fieldsToData(fields: string[]): string | null {
  for (let i = 0; i < fields.length; i += 2) if (fields[i] === 'data') return fields[i + 1] ?? null;
  return null;
}

/** Makes sure both consumer groups exist. Jobs added before the Python worker starts are still delivered. */
export async function ensureStreamGroups(redis: Redis): Promise<void> {
  for (const [stream, group] of [
    [STREAMS.cvJobs, GROUPS.cvWorkers],
    [STREAMS.cvResults, GROUPS.api],
  ] as const) {
    try {
      await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
    } catch (err) {
      if (!String((err as Error).message).includes('BUSYGROUP')) throw err;
    }
  }
}

/** Reads cv:results and applies each one. Runs in the worker process. */
export class CvResultsConsumer {
  private running = false;
  private readonly blocking: Redis;
  private readonly consumer = `${hostname()}-${process.pid}`;
  private loop: Promise<void> | null = null;
  private reclaimTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ctx: AppContext,
    private readonly log: Logger,
  ) {
    // Blocking reads tie up a connection, so they get their own.
    this.blocking = createRedis(ctx.env.REDIS_URL, 'cv-results');
  }

  async start(): Promise<void> {
    await ensureStreamGroups(this.ctx.redis);
    this.running = true;
    this.loop = this.run();
    this.reclaimTimer = setInterval(() => void this.reclaim().catch((err) => this.log.error({ err }, 'cv reclaim failed')), RECLAIM_IDLE_MS);
    this.reclaimTimer.unref();
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        const res = (await this.blocking.xreadgroup(
          'GROUP',
          GROUPS.api,
          this.consumer,
          'COUNT',
          20,
          'BLOCK',
          5000,
          'STREAMS',
          STREAMS.cvResults,
          '>',
        )) as [string, StreamEntry[]][] | null;
        if (!res) continue;
        for (const [, entries] of res) {
          for (const entry of entries) await this.handle(entry);
        }
      } catch (err) {
        if (!this.running) break;
        this.log.error({ err }, 'cv results read failed');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  private async handle([id, fields]: StreamEntry): Promise<void> {
    const raw = fieldsToData(fields);
    try {
      const parsed = CvResult.safeParse(raw ? JSON.parse(raw) : null);
      if (!parsed.success) {
        this.log.warn({ id, issues: parsed.error.issues }, 'bad cv result, moving to dead stream');
        await this.toDead(id, raw ?? '');
        return;
      }
      await applyCvResult(this.ctx, parsed.data);
      await this.ctx.redis.xack(STREAMS.cvResults, GROUPS.api, id);
    } catch (err) {
      // Left pending. The reclaim loop retries it, and gives up after a few tries.
      this.log.error({ err, id }, 'cv result failed');
    }
  }

  private async toDead(id: string, raw: string): Promise<void> {
    await this.ctx.redis
      .multi()
      .xadd(STREAMS.cvResultsDead, 'MAXLEN', '~', '10000', '*', 'data', raw, 'sourceId', id)
      .xack(STREAMS.cvResults, GROUPS.api, id)
      .exec();
  }

  /** Picks up results another worker took but never finished (it crashed, or the database was down). */
  async reclaim(): Promise<void> {
    const pending = (await this.ctx.redis.xpending(
      STREAMS.cvResults,
      GROUPS.api,
      'IDLE',
      RECLAIM_IDLE_MS,
      '-',
      '+',
      20,
    )) as [string, string, number, number][];
    for (const [id, , , deliveries] of pending) {
      const claimed = (await this.ctx.redis.xclaim(
        STREAMS.cvResults,
        GROUPS.api,
        this.consumer,
        RECLAIM_IDLE_MS,
        id,
      )) as StreamEntry[];
      const entry = claimed[0];
      if (!entry) continue;
      if (deliveries >= MAX_DELIVERIES) {
        this.log.warn({ id, deliveries }, 'cv result kept failing, moving to dead stream');
        await this.toDead(id, fieldsToData(entry[1]) ?? '');
        continue;
      }
      await this.handle(entry);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.reclaimTimer) clearInterval(this.reclaimTimer);
    this.blocking.disconnect();
    await this.loop?.catch(() => undefined);
  }
}
