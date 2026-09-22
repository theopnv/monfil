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
