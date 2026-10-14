import { Worker, type Job } from 'bullmq';
import type { FastifyBaseLogger as Logger } from 'fastify';
import type { AppContext } from '../context.js';
import { QUEUE_NAMES, type ImportJob, type ReportJob } from '../infra/queues.js';
import { runCommit, runInspect, runValidate } from '../modules/imports/service.js';
import { buildCsv, buildPdf, buildXlsx, gatherReportData } from '../modules/reports/build.js';
import { CvResultsConsumer } from './cv-results.js';

const CONTENT_TYPES = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv; charset=utf-8',
  PDF: 'application/pdf',
} as const;

async function processImport(ctx: AppContext, job: Job<ImportJob>): Promise<void> {
  const data = job.data;
  switch (data.kind) {
    case 'inspect':
      return runInspect(ctx, data.importId);
    case 'validate':
      return runValidate(ctx, data.importId);
    case 'commit':
      return runCommit(ctx, data.importId, data.actorId);
  }
}

async function processReport(ctx: AppContext, job: Job<ReportJob>): Promise<void> {
  const report = await ctx.db.report.findUnique({ where: { id: job.data.reportId } });
  if (!report || report.status === 'READY') return;
  await ctx.db.report.update({ where: { id: report.id }, data: { status: 'RUNNING' } });

  const data = await gatherReportData(ctx, report.auditId);
  const body =
    report.format === 'XLSX' ? buildXlsx(data) : report.format === 'CSV' ? buildCsv(data) : await buildPdf(ctx, data);
  const key = `reports/${report.auditId}/${report.id}.${report.format.toLowerCase()}`;
  await ctx.storage.put(key, body, CONTENT_TYPES[report.format]);

  await ctx.db.report.update({
    where: { id: report.id },
    data: { status: 'READY', storageKey: key, readyAt: new Date(), failureReason: null },
  });
  ctx.broadcaster.toUser(report.createdById, 'report:ready', {
    reportId: report.id,
    auditId: report.auditId,
    status: 'READY',
  });
}

export interface Workers {
  stop(): Promise<void>;
}

/** Starts every background consumer. Runs in the worker process, or in the API process locally. */
export async function startWorkers(ctx: AppContext, log: Logger): Promise<Workers> {
  const connection = { url: ctx.env.REDIS_URL, maxRetriesPerRequest: null };

  const imports = new Worker<ImportJob>(QUEUE_NAMES.imports, (job) => processImport(ctx, job), {
    connection,
    concurrency: 2,
  });
  const reports = new Worker<ReportJob>(QUEUE_NAMES.reports, (job) => processReport(ctx, job), {
    connection,
    concurrency: 2,
  });

  imports.on('failed', async (job, err) => {
    log.error({ err, jobId: job?.id, data: job?.data }, 'import job failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1) && job.data.kind !== 'commit') {
      // Commit failures put the import back to READY themselves. Other steps end as FAILED.
      await ctx.db.importBatch
        .update({
          where: { id: job.data.importId },
          data: { status: 'FAILED', failureReason: 'The file could not be processed' },
        })
        .catch(() => undefined);
    }
  });

  reports.on('failed', async (job, err) => {
    log.error({ err, jobId: job?.id }, 'report job failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const r = await ctx.db.report
        .update({
          where: { id: job.data.reportId },
          data: { status: 'FAILED', failureReason: 'The report could not be made. Try again.' },
        })
        .catch(() => null);
      if (r) ctx.broadcaster.toUser(r.createdById, 'report:ready', { reportId: r.id, auditId: r.auditId, status: 'FAILED' });
    }
  });

  const cv = new CvResultsConsumer(ctx, log);
  await cv.start();
  log.info('workers started');

  return {
    async stop() {
      await Promise.all([imports.close(), reports.close(), cv.stop()]);
    },
  };
}
