import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.config.ts' });

async function restrictedImports(code: string, filePath: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.filter((message) => message.ruleId === 'no-restricted-imports').length ?? 0;
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
