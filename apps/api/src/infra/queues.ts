import { Queue, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { STREAMS, STREAM_MAX_LEN, type CvJob } from './streams.js';

export const QUEUE_NAMES = {
  imports: 'imports',
  reports: 'reports',
} as const;

export type ImportJob =
  | { kind: 'inspect'; importId: string }
  | { kind: 'validate'; importId: string }
  | { kind: 'commit'; importId: string; actorId: string };

export interface ReportJob {
  reportId: string;
}

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** Producers for background work. Consumers live in src/jobs. */
export class Queues {
  readonly imports: Queue<ImportJob>;
  readonly reports: Queue<ReportJob>;

  constructor(
    connection: ConnectionOptions,
    private readonly redis: Redis,
  ) {
    this.imports = new Queue<ImportJob>(QUEUE_NAMES.imports, { connection, defaultJobOptions });
    this.reports = new Queue<ReportJob>(QUEUE_NAMES.reports, { connection, defaultJobOptions });
  }

  async addImport(job: ImportJob): Promise<void> {
    // Job id per import and step, so a double click cannot run the same step twice at once.
    await this.imports.add(job.kind, job, {
      jobId: `${job.importId}-${job.kind}-${Date.now()}`,
      // A commit writes to the audit. If it fails it goes back to READY and a
      // person decides to retry, rather than it running again on its own.
      ...(job.kind === 'commit' ? { attempts: 1 } : {}),
    });
  }

  async addReport(job: ReportJob): Promise<void> {
    await this.reports.add('generate', job, { jobId: job.reportId });
  }

  async addCvJob(job: CvJob): Promise<void> {
    await this.redis.xadd(STREAMS.cvJobs, 'MAXLEN', '~', String(STREAM_MAX_LEN), '*', 'data', JSON.stringify(job));
  }

  async close(): Promise<void> {
    await Promise.all([this.imports.close(), this.reports.close()]);
  }
}
