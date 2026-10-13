// Redis streams used between the API and the Python CV worker.
//
// cv:jobs     API adds a job when a photo upload is confirmed. Python reads it.
// cv:results  Python adds the result. The API worker reads it and updates the scan.
//
// Both sides use consumer groups, so a job is handed to one worker and stays
// pending until acknowledged. Messages that keep failing move to a :dead stream.

import { z } from 'zod';

export const STREAMS = {
  cvJobs: 'cv:jobs',
  cvResults: 'cv:results',
  cvResultsDead: 'cv:results:dead',
} as const;

export const GROUPS = {
  cvWorkers: 'cv-workers',
  api: 'api',
} as const;

/** Keep streams from growing forever. Old acknowledged entries are trimmed. */
export const STREAM_MAX_LEN = 100_000;

export const CvJob = z.object({
  scanId: z.uuid(),
  photoId: z.uuid(),
  storageKey: z.string(),
  /** Where to put the thumbnail. */
  thumbKey: z.string(),
  /** What the phone read, so the worker can report agreement. */
  deviceNumber: z.string(),
  attempt: z.number().int().min(1).default(1),
});
export type CvJob = z.infer<typeof CvJob>;

export const CvResult = z.object({
  scanId: z.uuid(),
  photoId: z.uuid(),
  ok: z.boolean(),
  error: z.string().max(500).nullable().optional(),
  colour: z
    .object({
      name: z.string().max(20),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      confidence: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
  ocr: z
    .object({
      number: z.string().max(32),
      confidence: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
  thumbKey: z.string().nullable().optional(),
});
export type CvResult = z.infer<typeof CvResult>;
