import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const secret = z.string().min(32, 'Must be at least 32 characters');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    TRUST_PROXY: bool,

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    JWT_SECRET: secret,
    COOKIE_SECRET: secret,
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    S3_ENDPOINT: z.string().url(),
    S3_PUBLIC_ENDPOINT: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.string().url().optional()),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().min(3),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: bool,

    IMPORT_MAX_BYTES: z.coerce.number().int().min(1024).default(20 * 1024 * 1024),
    IMPORT_MAX_ROWS: z.coerce.number().int().min(1).default(50_000),

    /** Run the background workers inside the API process. Handy locally, off in production. */
    WORKERS_IN_PROCESS: bool,

    /** Git commit of this build, shown by /health/live. Set by the deploy. */
    GIT_COMMIT: z.string().max(64).default('dev'),
    /** App versions below this are asked to update before they can be used. */
    APP_MIN_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/).default('0.0.0'),
    /** Newest app version. Older ones see a gentle update banner. */
    APP_LATEST_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/).default('0.0.0'),
    /** Comma separated feature switches to turn off, for example "photos,autoscan". */
    FEATURES_OFF: z.string().default(''),
    /** Which server this is, shown to people as a ribbon outside production. */
    APP_ENVIRONMENT: z.enum(['production', 'staging', 'development']).optional(),
    /** A line every app shows, for example planned downtime. Empty for none. */
    APP_NOTICE: z.string().max(200).default(''),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_SECRET', 'COOKIE_SECRET'] as const) {
        if (/change_me|dev_only/i.test(env[key])) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'Still the example value. Set a real secret.' });
        }
      }
      if (env.CORS_ORIGINS.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Set the dashboard origin in production' });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Reads and checks the environment. Throws with every problem listed, so the app never starts half configured. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Configuration problems:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
