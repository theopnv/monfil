// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import os from 'node:os';
import type { Page } from '@playwright/test';
import { expect, serve, test as base } from './fixtures';

interface Received {
  url: string | undefined;
  body: string;
}

type ErrorEvent = Record<string, unknown> & { tags?: Record<string, string>; exception?: { values?: { value?: string }[] }; contexts?: Record<string, unknown> };

const FEED_URL = 'https://private.example.com/secret-feed.xml';
const PROJECT_ID = '4242';

const test = base.extend<{ received: Received[]; dsn: string; appPage: Page }>({
  received: [async ({}, use) => {
    await use([]);
  }, { scope: 'test' }],

  dsn: async ({ received }, use) => {
    const server = await serve((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        received.push({ url: request.url, body: Buffer.concat(chunks).toString('utf8') });
        response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
      });
    });
    try {
      await use(`http://publickey@${new URL(server.origin).host}/${PROJECT_ID}`);
    } finally {
      await server.close();
    }
  },

  appPage: async ({ dsn, launchElectron }, use) => {
    const { page } = await launchElectron({ env: { MONFIL_SENTRY_ENDPOINT: dsn } });
    await page.waitForURL(/\/index\.html/, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
    await use(page);
  },
});

/** An envelope is lines of JSON: its header, then a header and a payload for each item. */
function itemsOf(received: Received[]): { type: string; payload: unknown; line: string }[] {
  return received.flatMap(({ body }) => {
    const lines = body.split('\n').filter(Boolean);
    const items: { type: string; payload: unknown; line: string }[] = [];
    for (let index = 1; index + 1 < lines.length; index += 2) {
      try {
        const header = JSON.parse(lines[index] ?? '') as { type?: string };
        items.push({ type: header.type ?? '', payload: JSON.parse(lines[index + 1] ?? ''), line: lines[index + 1] ?? '' });
      } catch {
        // A binary item such as an attachment is not JSON.
      }
    }
    return items;
  });
}

const errorEvents = (received: Received[]) => itemsOf(received).filter((item) => item.type === 'event').map((item) => item.payload as ErrorEvent);

async function setConsent(page: Page, value: 'granted' | 'denied'): Promise<void> {
  await page.evaluate((choice) => window.electron.ipcRenderer.invoke('settings:set', { key: 'usageAnalytics', value: choice }), value);
}

const reportsEnabled = (page: Page) => page.evaluate(async () => (await window.electron.ipcRenderer.invoke('report:get-state', undefined) as { enabled: boolean }).enabled);

/** The path a renderer failure takes: the preload bridge sends it to main, and main logs it as a `renderer.failure`. */
async function failInRenderer(page: Page, name: string): Promise<void> {
  await page.evaluate(({ errorName, home, feedUrl }) => {
    window.electron.ipcRenderer.sendMessage('log:write', {
      level: 'error',
      event: 'renderer.failure',
      data: { message: 'Root render failed', incidentId: 'a1b2c3d4-0000-4000-8000-000000000000' },
      error: `${errorName}: could not read ${home}/Documents/feeds.opml or ${feedUrl}\n    at readFeed (file://${home}/monfil/.vite/renderer/main_window/assets/index.js:10:5)`,
    });
  }, { errorName: name, home: os.homedir(), feedUrl: FEED_URL });
}

test('sends nothing until the user agrees, and nothing after they withdraw', async ({ appPage, received }) => {
  // Act
  await failInRenderer(appPage, 'UnsetError');
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(0);
  expect(await reportsEnabled(appPage)).toBe(false);

  // Act
  await setConsent(appPage, 'denied');
  await failInRenderer(appPage, 'DeniedError');
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(0);
  expect(await reportsEnabled(appPage)).toBe(false);
});

test('sends a scrubbed event when the user agrees, and stops when they withdraw', async ({ appPage, received }) => {
  // Arrange
  await setConsent(appPage, 'granted');
  await expect.poll(() => reportsEnabled(appPage)).toBe(true);

  // Act
  await failInRenderer(appPage, 'GrantedError');
  await expect.poll(() => errorEvents(received).length).toBeGreaterThan(0);

  // Assert
  const [event] = errorEvents(received);
  expect(event?.tags).toMatchObject({ logEvent: 'renderer.failure', incidentId: 'a1b2c3d4' });
  expect(event?.['release']).toMatch(/^monfil@\d+\.\d+\.\d+/);
  expect(event?.exception?.values?.[0]?.value).toContain('~/Documents/feeds.opml');
  for (const key of ['user', 'request', 'server_name', 'extra', 'modules']) {
    expect(event).not.toHaveProperty(key);
  }
  expect(received.every((request) => request.url?.startsWith(`/api/${PROJECT_ID}/envelope/`))).toBe(true);
  for (const request of received) {
    for (const secret of [os.homedir(), os.userInfo().username, 'private.example.com', 'secret-feed']) {
      expect(request.body).not.toContain(secret);
    }
  }

  // Act
  await setConsent(appPage, 'denied');
  await expect.poll(() => reportsEnabled(appPage)).toBe(false);
  const before = received.length;
  await failInRenderer(appPage, 'WithdrawnError');
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(before);
});

test('sends reports again when the user agrees a second time in the same run', async ({ appPage, received }) => {
  // Arrange
  await setConsent(appPage, 'granted');
  await expect.poll(() => reportsEnabled(appPage)).toBe(true);
  await setConsent(appPage, 'denied');
  await expect.poll(() => reportsEnabled(appPage)).toBe(false);

  // Act
  await setConsent(appPage, 'granted');
  await expect.poll(() => reportsEnabled(appPage)).toBe(true);
  await failInRenderer(appPage, 'SecondGrantError');

  // Assert
  await expect.poll(() => errorEvents(received).some((event) => JSON.stringify(event).includes('SecondGrantError'))).toBe(true);
});

test('links a comment and the log file to the event of the incident, with no personal data', async ({ appPage, received }) => {
  // Arrange
  await setConsent(appPage, 'granted');
  await expect.poll(() => reportsEnabled(appPage)).toBe(true);
  await failInRenderer(appPage, 'FeedbackError');
  await expect.poll(() => errorEvents(received).length).toBeGreaterThan(0);
  const [event] = errorEvents(received);

  // Act
  const result = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('report:submit', { incidentId: 'a1b2c3d4', comment: 'I was opening my reading list', attachLog: true }));

  // Assert
  expect(result).toEqual({ success: true, data: undefined });
  await expect.poll(() => itemsOf(received).some((item) => item.type === 'feedback')).toBe(true);
  const feedback = itemsOf(received).find((item) => item.type === 'feedback')?.payload as ErrorEvent;
  expect(feedback.contexts).toMatchObject({ feedback: { message: 'I was opening my reading list', associated_event_id: event?.['event_id'] } });
  expect(received.some((request) => request.body.includes('monfil.log'))).toBe(true);
  // The log keeps the host names that the local log already shows, and the user previews it before they attach it.
  for (const request of received) {
    for (const secret of [os.homedir(), os.userInfo().username, 'secret-feed']) {
      expect(request.body).not.toContain(secret);
    }
  }
});
