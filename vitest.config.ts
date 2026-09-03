import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` is a marker module that Next aliases per environment: a
      // no-op inside the React Server Component graph, a hard throw anywhere
      // else. Unit tests import server-side libs directly, so point it at the
      // no-op build instead of letting resolution fail.
      'server-only': 'next/dist/compiled/server-only/empty.js',
    },
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
