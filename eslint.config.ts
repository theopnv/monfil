// @ts-check

import js from '@eslint/js';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import { LIMITS } from './scripts/complexity/limits.mts';
import { physicalTailwindClassRule } from './scripts/lint/physical-tailwind-class.mts';
import { strykerDisableRule } from './scripts/mutation/eslint-rule.mts';

type ESLintPlugin = NonNullable<Linter.Config['plugins']>[string];

export default defineConfig([
  {
    ignores: ['dist/**', '.vite/**', 'out/**', 'coverage/**', '.vitest/**', '.mutation/**', '.stryker-tmp/**', '.claude/**', 'doc/**', 'infra/**'],
  },
  {
    files: ['**/*.{js,ts,jsx,tsx}', 'scripts/**/*.mts'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      parserOptions: {
        // A nested checkout brings a second tsconfig.json; without this the parser refuses to guess between them.
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: ['src/*/boundary-test.ts', 'src/*/example.ts', 'src/renderer/components/untitled-ui/example.ts', 'src/renderer/components/example.tsx', 'src/renderer/components/example.test.tsx', 'src/renderer/components/untitled-ui/example.tsx'],
          // The rule tests lint more example files than the default limit of 8.
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
        },
      },
    },
    plugins: {
      '@stylistic': stylistic,
      '@sonarjs': sonarjs
    },
    rules: {
      'curly': ['error', 'all'],
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
      // Match tsconfig's noUnusedParameters, which already treats a leading underscore as deliberate.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/nonblock-statement-body-position': ['error', 'below'],
      '@stylistic/indent': ['error', 2],
      'no-console': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'mutation': { rules: { 'stryker-disable': strykerDisableRule } },
    },
    rules: {
      'mutation/stryker-disable': 'error',
      '@sonarjs/cognitive-complexity': ['error', LIMITS.cognitive],
      '@sonarjs/cyclomatic-complexity': ['error', { threshold: LIMITS.cyclomatic }]
    }
  },
  {
    files: ['src/renderer/components/untitled-ui/**', 'src/**/*.test.{ts,tsx}'],
    rules: {
      '@sonarjs/cognitive-complexity': 'off',
      '@sonarjs/cyclomatic-complexity': 'off'
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks as unknown as ESLintPlugin,
      'layout': { rules: { 'logical-classes': physicalTailwindClassRule } },
    },
    rules: {
      'layout/logical-classes': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.object.object.name='window'][object.object.property.name='electron'][object.property.name='ipcRenderer']",
        message: 'Use the typed renderer IPC client.',
      }],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/main/**', '**/preload/**'], message: 'Renderer code can import cross-process data only from src/shared.' },
          { group: ['sonner'], message: 'Import Sonner only through the notification adapter.' },
        ],
      }],
    },
  },
  {
    files: ['src/renderer/components/untitled-ui/**'],
    rules: { 'layout/logical-classes': 'off' },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ignores: ['src/renderer/**/*.test.{ts,tsx}', 'src/renderer/components/untitled-ui/**', 'src/renderer/routeTree.gen.ts', 'src/renderer/lib/test/**'],
    plugins: { i18next: i18next as unknown as ESLintPlugin },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-only',
        'jsx-attributes': {
          include: ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'alt', 'placeholder', 'label', 'textValue', 'description', 'hint', 'tooltip', 'helperText', 'heading'],
        },
        words: {
          // The brand name, punctuation and symbols, shouting codes such as RSS, and the values that route and aria props take.
          exclude: ['^Monfil\\b.*', '^[\\s0-9!-/:-@\\[-`{-~·—–…]+$', '^[A-Z_-]+$', '^(all|saved|page|bottom-right|top|end|start)$'],
        },
      }],
    },
  },
  {
    files: ['src/renderer/lib/ipc-client.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/renderer/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/renderer/lib/notifications.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/main/**', '**/preload/**'], message: 'Renderer code can import cross-process data only from src/shared.' }],
      }],
    },
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/renderer/**', '**/preload/**'], message: 'Main code can import cross-process data only from src/shared.' },
          { group: ['electron-log', 'electron-log/*'], message: 'Import electron-log only through the logging adapter.' },
        ],
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
    files: ['src/main/logging/logger.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/renderer/**', '**/preload/**'], message: 'Main code can import cross-process data only from src/shared.' }],
      }],
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
  }
]);
