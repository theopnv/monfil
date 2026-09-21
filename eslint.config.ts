// @ts-check

import js from '@eslint/js';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'

type ESLintPlugin = NonNullable<Linter.Config['plugins']>[string];

export default defineConfig([
  {
    ignores: ['dist/**', '.vite/**', 'out/**', '.claude/**'],
  },
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      parserOptions: {
        // A nested checkout brings a second tsconfig.json; without this the parser refuses to guess between them.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      'curly': ['error', 'all'],
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
      // Match tsconfig's noUnusedParameters, which already treats a leading underscore as deliberate.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/nonblock-statement-body-position': ['error', 'below'],
      '@stylistic/indent': ['error', 2],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks as unknown as ESLintPlugin,
    },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/main/**', '**/preload/**'], message: 'Renderer code can import cross-process data only from src/shared.' }],
      }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/renderer/**', '**/preload/**'], message: 'Main code can import cross-process data only from src/shared.' }],
      }],
      'no-restricted-globals': ['error',
        { name: 'document', message: 'The main process has no DOM.' },
        { name: 'window', message: 'The main process has no DOM.' },
        { name: 'localStorage', message: 'The main process has no DOM.' },
        { name: 'navigator', message: 'The main process has no DOM.' },
      ],
    },
  },
  {
    files: ['src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/main/**', '**/renderer/**'], message: 'Preload code can import cross-process data only from src/shared.' }],
      }],
    },
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/main/**', '**/preload/**', '**/renderer/**'], message: 'Shared code must stay process-neutral.' }],
      }],
    },
  },
]);
