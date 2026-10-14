import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['test/global-setup.ts'],
          // Files share one database, so they run one after another.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
