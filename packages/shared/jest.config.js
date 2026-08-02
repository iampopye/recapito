/**
 * Jest config for the shared types/constants package.
 *
 * This package is mostly TypeScript interfaces, which erase at runtime and
 * cannot be tested. What CAN be tested -- and is worth testing -- are the
 * runtime constant objects that both the backend and the IMAP daemon depend
 * on for wire-format values.
 */
module.exports = {
  displayName: 'shared',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: true }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'lcov'],
};
