// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('a second launch exits and focuses the existing window', async () => {
  // Arrange
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-single-instance-'));
  let primary: ElectronApplication | undefined;
  let secondary: ChildProcess | undefined;
  try {
    const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    primary = app;
    await app.firstWindow();
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
    const child = spawn(app.process().spawnfile, ['.', `--user-data-dir=${userDataDir}`], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
      stdio: 'ignore',
      timeout: 10000,
    });
    secondary = child;
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });

    // Assert
    expect(exitCode).toBe(0);
    await expect.poll(() => app.evaluate(() => (globalThis as typeof globalThis & { singleInstanceCalls: string[] }).singleInstanceCalls)).toEqual(['show', 'focus']);
    expect(await app.evaluate(({ app }) => app.hasSingleInstanceLock())).toBe(true);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => window.id))).toEqual([windowId]);
  } finally {
    secondary?.kill();
    await primary?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
