/**
 * Jest config for the NestJS backend.
 *
 * Jest (not Vitest) because NestJS ships with it, and because these tests lean
 * on `emitDecoratorMetadata` for DI. ts-jest compiles with the app's own
 * tsconfig, so decorator metadata behaves exactly as it does at runtime.
 *
 * Everything here is a unit test against mocked TypeORM repositories -- there
 * is deliberately no database. If a test ever needs Postgres, it belongs in a
 * separate e2e project with its own config, not in here.
 */
module.exports = {
  displayName: 'backend',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        // Type errors in a spec should fail the spec, not be silently skipped.
        diagnostics: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Resolve the workspace package from source so `pnpm test` works on a fresh
  // clone without having to build packages/shared first.
  moduleNameMapper: {
    '^@recapito/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/entities/**',
    '!src/migrations/**',
    '!src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'lcov'],
};
