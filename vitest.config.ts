import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // No jsdom on purpose: every decidable behaviour lives in src/core, which is
    // pure and DOM-free. The DOM wiring is proven by Playwright against the real
    // built artifact instead.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Thin DOM wiring — covered end-to-end by Playwright against dist/index.html,
        // which is the only place its behaviour is real (clipboard, aria-live, file://).
        'src/ui/**',
        'src/app.ts',
        'src/**/*.test.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        'src/core/**/*.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
