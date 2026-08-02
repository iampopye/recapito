// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import prettierConfig from 'eslint-config-prettier';

/**
 * Flat ESLint config for the Recapito pnpm workspace.
 *
 * Layering (later blocks win):
 *   1. global ignores
 *   2. JS/TS baseline for every workspace
 *   3. type-aware async-safety rules (the codebase is IMAP/HTTP heavy, so a
 *      dropped promise is a real production bug, not a style nit)
 *   4. per-workspace overrides: NestJS backend / Next.js frontend / Node daemon
 *   5. test-file relaxations
 *   6. prettier last, so formatting is never an ESLint concern
 *
 * ---------------------------------------------------------------------------
 * CALIBRATION -- please read before tightening anything.
 *
 * This config is deliberately tuned so that `pnpm lint` reports ZERO ERRORS on
 * the codebase as it stands. A lint setup that greets a new contributor with
 * 95 errors is a lint setup that gets deleted, so several rules that are
 * genuinely worth having are set to 'warn' instead of 'error', each with the
 * measured size of its existing backlog recorded below.
 *
 * Measured on the pre-existing tree (113 TS/TSX files):
 *
 *   @typescript-eslint/no-floating-promises   53 findings  -> warn
 *   react-hooks/immutability                  17 findings  -> off
 *   @typescript-eslint/no-unused-vars         15 findings  -> warn
 *   @typescript-eslint/no-misused-promises     5 findings  -> warn
 *   react-hooks/set-state-in-effect            3 findings  -> off
 *   react/no-unescaped-entities                2 findings  -> off
 *
 * The ratchet: fix a category, then flip it to 'error' so it can never come
 * back. CI passes `--max-warnings` (see the root `lint` script), so the total
 * warning count cannot silently grow either.
 *
 * NOTE: the type-aware block requires `packages/shared` to have been BUILT
 * (it is consumed via its `dist/` types). The root `lint` script does that
 * for you; running bare `npx eslint .` on a clean checkout will not.
 * ---------------------------------------------------------------------------
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'apps/frontend/next-env.d.ts',
      'apps/backend/src/migrations/**',
      'pnpm-lock.yaml',
    ],
  },

  // ---------------------------------------------------------------- baseline
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'warn',
      'no-return-await': 'off', // superseded by @typescript-eslint/return-await
      // 15 pre-existing findings, mostly unused imports in the IMAP daemon and
      // in service files owned by another workstream. Cheap to fix, but not
      // mine to touch right now. TIGHTEN TO 'error' once cleared.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // `any` appears at third-party boundaries (imapflow, mailparser, Mailgun
      // webhook payloads) where no useful type exists upstream.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // --------------------------------------------- type-aware async safety net
  // Only the rules that catch genuine bugs. The full `recommendedTypeChecked`
  // preset is deliberately not enabled: its `no-unsafe-*` family would bury the
  // signal under thousands of pre-existing findings.
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // THE most valuable rule in this file: an unawaited promise in an IMAP
      // sync loop is a silently-lost mailbox update. 53 pre-existing findings
      // is too many to fail the build on today, but every one of them is worth
      // looking at. TIGHTEN TO 'error' once the backlog is cleared.
      '@typescript-eslint/no-floating-promises': 'warn',
      // 5 pre-existing findings, all `setInterval(async () => ...)` style.
      // TIGHTEN TO 'error' once cleared.
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } },
      ],
      // These have zero pre-existing findings, so they stay as errors and act
      // as a genuine gate on new code.
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-duplicate-type-constituents': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
    },
  },

  // ------------------------------------------------------- backend (NestJS)
  {
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // NestJS DI relies on parameter decorators and empty constructor bodies.
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['constructors', 'arrowFunctions'] },
      ],
      // Entity/DTO classes are initialised by TypeORM & class-transformer.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Decorator metadata legitimately references types as values: rewriting
      // `import { Repository }` to `import type` erases the metadata NestJS
      // needs at runtime, which breaks DI in ways that only show up on boot.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },

  // -------------------------------------------------- frontend (Next.js 14)
  {
    files: ['apps/frontend/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // The App Router does not need React in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // The two hook rules that actually catch broken UI.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // --- eslint-plugin-react-hooks v7 React-Compiler rules, disabled ---
      // v7 folded the React Compiler's static analysis into its `recommended`
      // preset. Those rules presuppose a codebase that is being compiled by
      // the React Compiler; this app is not, and is on React 18. They produce
      // 17 + 3 findings here that are not bugs under the current runtime.
      // REVISIT if/when this app adopts React 19 + the React Compiler.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',

      // Demands `&apos;` for a typed apostrophe. Pure noise, no correctness
      // benefit for an app that is not doing entity-sensitive templating.
      'react/no-unescaped-entities': 'off',
    },
  },

  // ---------------------------------------------- imap-daemon (plain Node)
  {
    files: ['apps/imap-daemon/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      'no-process-exit': 'off',
    },
  },

  // ------------------------------------------------- shared types package
  {
    files: ['packages/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
  },

  // ------------------------------------------------------------- test files
  {
    files: ['**/*.{spec,test}.{ts,tsx}', '**/__tests__/**/*.ts', '**/testing/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022, ...globals.jest },
    },
    rules: {
      // A test double is not obliged to satisfy the full production interface.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // Deliberate fire-and-forget promises are common in rejection assertions.
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  // ----------------------------------------------- root tooling config files
  {
    files: ['*.{js,mjs,cjs,ts}', '**/*.config.{js,cjs,mjs}', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Must stay last: disables every rule Prettier already owns.
  prettierConfig,
);
