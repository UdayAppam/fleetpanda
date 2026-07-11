/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        // Type-only modules: no executable statements to cover.
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/types/**',
        // Mock/demo backend scaffolding (a test double, like src/test/**): browser.ts is a
        // browser-only Service Worker bootstrap that cannot run under jsdom, and handlers.ts
        // is the emulated API used by the demo. Their behaviour is still asserted by tests
        // (e.g. src/mocks/handlers.test.ts) but they aren't application code under measure.
        'src/mocks/**',
      ],
      // Lock in full coverage so any regression fails the run.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
