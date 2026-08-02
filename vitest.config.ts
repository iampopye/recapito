import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Root Vitest configuration for the Recapito workspace.
 *
 * The backend is compiled with SWC rather than esbuild because NestJS and
 * TypeORM both depend on `emitDecoratorMetadata`, which esbuild does not
 * implement. Without it, importing an entity throws
 * `ColumnTypeUndefinedError` at module-evaluation time.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          swc.vite({
            module: { type: 'es6' },
            jsc: {
              target: 'es2022',
              parser: {
                syntax: 'typescript',
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          }),
        ],
        test: {
          name: 'backend',
          root: './apps/backend',
          environment: 'node',
          globals: false,
          include: ['src/**/*.spec.ts'],
          setupFiles: ['./src/testing/setup.ts'],
        },
      },
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          environment: 'node',
          globals: false,
          include: ['src/**/*.spec.ts'],
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      all: false,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.spec.ts',
        '**/testing/**',
        '**/*.module.ts',
        '**/*.dto.ts',
        '**/entities/**',
        '**/migrations/**',
        '**/main.ts',
      ],
    },

    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
});
