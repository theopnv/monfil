// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { ESLint } from 'eslint';
import { describe, expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 15_000 });

const eslint = new ESLint({ overrideConfigFile: 'eslint.config.ts' });

async function restrictedImports(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.filter((message) => message.ruleId === 'no-restricted-imports').length ?? 0;
}

async function ruleErrors(code: string, filePath: string, ruleId: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.filter((message) => message.ruleId === ruleId).length ?? 0;
}

describe('process import boundaries', () => {
  test.each([
    ['src/renderer/boundary-test.ts', '../main/main'],
    ['src/renderer/boundary-test.ts', '../preload/preload'],
    ['src/main/boundary-test.ts', '../renderer/index'],
    ['src/main/boundary-test.ts', '../preload/preload'],
    ['src/preload/boundary-test.ts', '../main/main'],
    ['src/preload/boundary-test.ts', '../renderer/index'],
    ['src/shared/boundary-test.ts', '../main/main'],
    ['src/shared/boundary-test.ts', '../preload/preload'],
    ['src/shared/boundary-test.ts', '../renderer/index'],
  ])('rejects %s importing %s', async (filePath, importPath) => {
    const errors = await restrictedImports(`import '${importPath}';`, filePath);
    expect(errors).toBe(1);
  });

  test.each([
    ['src/renderer/boundary-test.ts', '../shared/contracts'],
    ['src/main/boundary-test.ts', '../shared/contracts'],
    ['src/preload/boundary-test.ts', '../shared/contracts'],
  ])('allows %s importing %s', async (filePath, importPath) => {
    const errors = await restrictedImports(`import '${importPath}';`, filePath);
    expect(errors).toBe(0);
  });

  test('rejects DOM globals in main code', async () => {
    const [result] = await eslint.lintText("document.title = 'main';", { filePath: 'src/main/boundary-test.ts' });
    expect(result?.messages.some((message) => message.ruleId === 'no-restricted-globals')).toBe(true);
  });
});

describe('error framework boundaries', () => {
  test('rejects direct console logging', async () => {
    expect(await ruleErrors("console.error('failure');", 'src/main/example.ts', 'no-console')).toBe(1);
  });

  test('rejects electron-log outside its adapter', async () => {
    expect(await restrictedImports("import log from 'electron-log/main';", 'src/main/example.ts')).toBe(1);
  });

  test('rejects Sonner outside its adapter', async () => {
    expect(await restrictedImports("import { toast } from 'sonner';", 'src/renderer/example.ts')).toBe(1);
  });

  test('rejects raw renderer IPC access', async () => {
    const count = await ruleErrors("window.electron.ipcRenderer.invoke('app:get-info', undefined);", 'src/renderer/example.ts', 'no-restricted-syntax');
    expect(count).toBe(1);
  });

  test('rejects floating promises', async () => {
    const count = await ruleErrors('Promise.resolve();', 'src/shared/example.ts', '@typescript-eslint/no-floating-promises');
    expect(count).toBe(1);
  });
});

describe('complexity limits', () => {
  const nestedConditions = `export function nested(a: boolean, b: boolean): number {
  if (a && b) {
    if (a && b) {
      if (a && b) {
        if (a && b) {
          if (a && b) {
            if (a && b) {
              return 1;
            }
          }
        }
      }
    }
  }
  return 0;
}
`;

  test.each(['@sonarjs/cognitive-complexity', '@sonarjs/cyclomatic-complexity'])('rejects %s above the limit in app code', async (ruleId) => {
    // Act
    const count = await ruleErrors(nestedConditions, 'src/main/example.ts', ruleId);

    // Assert
    expect(count).toBe(1);
  });

  test.each([
    ['src/renderer/components/untitled-ui/base/buttons/button.tsx', '@sonarjs/cognitive-complexity'],
    ['src/renderer/components/untitled-ui/base/buttons/button.tsx', '@sonarjs/cyclomatic-complexity'],
    ['src/main/settings.test.ts', '@sonarjs/cognitive-complexity'],
    ['src/main/settings.test.ts', '@sonarjs/cyclomatic-complexity'],
  ])('allows complex code in %s for %s', async (filePath, ruleId) => {
    // Act
    const [result] = await eslint.lintText(nestedConditions, { filePath });

    // Assert
    expect(result?.fatalErrorCount).toBe(0);
    expect(result?.messages.filter((message) => message.ruleId === ruleId)).toHaveLength(0);
  });
});

describe('Stryker suppression comments', () => {
  test.each([
    ['a named mutator with a reason', '// Stryker disable next-line StringLiteral: the label only reaches the log'],
    ['two named mutators with a reason', '// Stryker disable next-line EqualityOperator,ConditionalExpression: both bounds give the same slice'],
    ['a restore comment', '// Stryker restore all'],
    ['an unrelated comment', '// Disable the button while the request runs'],
  ])('accepts %s', async (_label, comment) => {
    // Act
    const count = await ruleErrors(`${comment}\nexport const a = 1;\n`, 'src/main/example.ts', 'mutation/stryker-disable');

    // Assert
    expect(count).toBe(0);
  });

  test.each([
    ['a comment without a reason', '// Stryker disable next-line StringLiteral'],
    ['a comment with an empty reason', '// Stryker disable next-line StringLiteral:   '],
    ['all mutators', '// Stryker disable next-line all: noisy'],
    ['all mutators in a list', '// Stryker disable next-line StringLiteral,all: noisy'],
    ['a range disable', '// Stryker disable StringLiteral: the labels only reach the log'],
    ['a block comment range disable', '/* Stryker disable all */'],
  ])('rejects %s', async (_label, comment) => {
    // Act
    const count = await ruleErrors(`${comment}\nexport const a = 1;\n`, 'src/main/example.ts', 'mutation/stryker-disable');

    // Assert
    expect(count).toBe(1);
  });
});
