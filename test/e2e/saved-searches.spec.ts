// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';

const JOBS = [
  { title: 'Backend Engineer', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60,000–€75,000 / year' },
  { title: 'Engineering Manager', location: 'Paris', workMode: 'on-site', salaryLabel: undefined },
  { title: 'Product Designer', location: 'Lyon', workMode: 'remote', salaryLabel: undefined },
];

test('a saved search keeps its jobs after they are read, and its count drops', async () => {
  // Arrange: the board is stored as the Lever adapter would store it, since the adapter only reads known public hosts.
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-searches-'));
  let app: ElectronApplication | undefined;
  const launch = async () => {
    await app?.close();
    app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    return app.firstWindow();
  };
  try {
    const setup = await launch();
    await setup.evaluate(async ({ workspaceId, jobs }) => {
      await window.electron.ipcRenderer.invoke('settings:set-refresh-on-launch', false);
      const result = await window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
        workspaceId, link: 'https://api.lever.co/v0/postings/acme?mode=json', title: 'Acme · Jobs', type: 'ats',
        categoryName: 'Jobs', showInWorkspace: true,
        items: jobs.map((job, index) => ({
          title: job.title, guid: `lever:${index}`, link: undefined, pubDate: new Date(Date.now() - index * 1000).toISOString(),
          description: `<p>${job.title} at Acme.</p>`, image: undefined, author: 'Acme', read_at: undefined,
          extra: JSON.stringify({ provider: 'lever', company: 'Acme', location: job.location, workMode: job.workMode, salaryLabel: job.salaryLabel }),
        })),
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
    }, { workspaceId: HOME_WORKSPACE_ID, jobs: JOBS });
    const page = await launch();
    await page.getByRole('radio', { name: 'All', exact: true }).click();

    // Assert: every job shows, with the card details.
    for (const job of JOBS) {
      await expect(page.getByText(job.title, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Acme · Paris').first()).toBeVisible();
    await expect(page.getByText('salary not shown').first()).toBeVisible();
    await expect(page.getByText('€60,000–€75,000 / year')).toBeVisible();

    // Act: search with operators and keep the search as a pill.
    await page.getByPlaceholder('Search').fill('title:engineer -manager');
    await expect(page.getByText('Engineering Manager', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Product Designer', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save search' }).click();
    await page.getByRole('textbox', { name: 'Name of the saved search' }).fill('Engineers');
    await page.getByRole('dialog', { name: 'Name this search' }).getByRole('button', { name: 'Save', exact: true }).click();

    // Assert
    const pill = page.getByRole('button', { name: 'Engineers, 1 unread' });
    await expect(pill).toHaveAttribute('aria-pressed', 'true');

    // Act: read the job from outside the page, then reload so the pill state starts clean.
    await page.evaluate(async (workspaceId) => {
      const page = await window.electron.ipcRenderer.invoke('items:query', { workspaceId, limit: 50, search: 'title:backend' });
      if (!('rows' in page)) {
        throw new Error('The river did not load.');
      }
      await window.electron.ipcRenderer.invoke('items:set-read', { itemIds: page.rows.map((row) => row.id), read: true });
    }, HOME_WORKSPACE_ID);
    await page.reload();

    // Assert: the count drops to zero, and the read job still shows once the pill is selected.
    await page.getByRole('radio', { name: 'Unread', exact: true }).click();
    await expect(page.getByText('Backend Engineer', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Engineers, 0 unread' }).click();
    await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
    await expect(page.getByText('Backend Engineer', { exact: true })).toBeVisible();
    await expect(page.getByText('Engineering Manager', { exact: true })).toHaveCount(0);
  } finally {
    await app?.close();
    await rm(userDataDir, { recursive: true });
  }
});
