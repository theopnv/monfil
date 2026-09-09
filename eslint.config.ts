// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
  {
    ignores: ['dist/**', '.vite/**', 'out/**'],
  },
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
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
]);
