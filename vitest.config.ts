import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.d.ts',
        'vitest.config.ts'
      ],
      // Thresholds disabled for now - badge will show actual coverage
      // Enable once unit tests are expanded to import source modules
      // thresholds: {
      //   statements: 50,
      //   branches: 50,
      //   functions: 50,
      //   lines: 50
      // }
    }
  }
});
