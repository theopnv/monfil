import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { app, webContents } from 'electron';

type CoverageMap = Record<string, unknown>;

declare global {
  var __coverage__: CoverageMap | undefined;
}

const RENDERER_TIMEOUT_MS = 5000;

function write(maps: CoverageMap[]): void {
  const dir = path.resolve(process.env['COVERAGE_DIR'] ?? 'coverage/e2e/raw');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${process.pid}-${randomUUID()}.json`), JSON.stringify(maps));
}

async function rendererCoverage(contents: Electron.WebContents): Promise<CoverageMap | undefined> {
  const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, RENDERER_TIMEOUT_MS));
  try {
    return await Promise.race([contents.executeJavaScript('window.__coverage__') as Promise<CoverageMap | undefined>, timeout]);
  } catch {
    return undefined;
  }
}

async function dumpMain(): Promise<void> {
  const live = webContents.getAllWebContents().filter((contents) => !contents.isDestroyed());
  const maps = [globalThis.__coverage__, ...(await Promise.all(live.map(rendererCoverage)))];
  write(maps.filter((map): map is CoverageMap => map !== undefined));
}

// Playwright's app.close() calls app.quit(). The first quit waits for the dump, and the second one goes through.
function dumpOnQuit(): void {
  let dumped = false;
  app.on('before-quit', (event) => {
    if (dumped) {
      return;
    }
    dumped = true;
    event.preventDefault();
    dumpMain().catch(() => undefined).finally(() => app.quit());
  });
}

// The parent stops the utility process with a signal, which skips the exit event unless it exits itself.
function dumpOnExit(): void {
  process.on('SIGTERM', () => process.exit(0));
  process.on('exit', () => {
    if (globalThis.__coverage__) {
      write([globalThis.__coverage__]);
    }
  });
}

if (process.type === 'browser') {
  dumpOnQuit();
} else if (process.type === 'utility') {
  dumpOnExit();
}
