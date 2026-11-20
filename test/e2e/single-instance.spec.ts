// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from './fixtures';

test('a second launch exits and focuses the existing window', async ({ launchElectron, userDataDir }) => {
  // Arrange
  let secondary: ChildProcess | undefined;
  try {
    const { app } = await launchElectron();
    const executablePath = await app.evaluate(() => process.execPath);
    const windowId = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window) {
        throw new Error('Main window was not created');
      }
      const calls: string[] = [];
      Object.assign(globalThis, { singleInstanceCalls: calls });
      window.show = () => {
        calls.push('show');
      };
      window.focus = () => {
        calls.push('focus');
      };
      return window.id;
    });

    // Act
    const child = spawn(executablePath, [
      '--no-sandbox',
      '--disable-features=AutoDeElevate',
      '.',
      `--user-data-dir=${userDataDir}`,
    ], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 10000,
    });
    secondary = child;
    let stderr = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (data: string) => {
      stderr += data;
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });

    // Assert
    expect(exitCode, stderr).toBe(0);
    await expect.poll(() => app.evaluate(() => (globalThis as typeof globalThis & { singleInstanceCalls: string[] }).singleInstanceCalls)).toEqual(['show', 'focus']);
    expect(await app.evaluate(({ app }) => app.hasSingleInstanceLock())).toBe(true);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => window.id))).toEqual([windowId]);
  } finally {
    secondary?.kill();
  }
});
