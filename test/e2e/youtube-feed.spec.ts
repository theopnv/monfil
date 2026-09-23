import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NewFeedInput } from '../../src/shared/contracts';
import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';

const FIXTURE_PUB_DATE = new Date().toUTCString();

type YoutubeFeedTestFixtures = {
  userDataDir: string;
  launchApp: () => Promise<Page>;
};

const youtubeFeedTest = base.extend<YoutubeFeedTestFixtures>({
  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true });
    }
  },

  launchApp: async ({ userDataDir }, use) => {
    const launched: ElectronApplication[] = [];
    try {
      await use(async () => {
        const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
        launched.push(app);
        return app.firstWindow();
      });
    } finally {
      await Promise.all(launched.map((app) => app.close()));
    }
  },
});

const ICON_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const THUMBNAIL_URL = ICON_URL;
const CHANNEL_LINK = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012';
const VIDEO_DESCRIPTION = 'Full video notes.\n\nMore at: https://example.com/more';

// The resolver only recognizes a live youtube.com host, so this ships the already-parsed feed
// straight over IPC, exactly as the Add Feed wizard would after resolving it. No network involved.
async function subscribeYoutube(page: Page): Promise<void> {
  await page.evaluate((payload) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', payload), {
    link: CHANNEL_LINK,
    title: 'Local Channel',
    type: 'youtube',
    icon: ICON_URL,
    categoryName: 'tech',
    workspaceId: HOME_WORKSPACE_ID,
    showInWorkspace: true,
    items: [
      {
        title: 'A Video',
        guid: 'yt:video:abc123',
        link: 'https://www.youtube.com/watch?v=abc123',
        pubDate: FIXTURE_PUB_DATE,
        description: VIDEO_DESCRIPTION,
        image: THUMBNAIL_URL,
        author: 'Local Channel',
        extra: JSON.stringify({ videoId: 'abc123', channelId: 'UC1234567890123456789012', views: 100, rating: 4.5 }),
        read_at: undefined,
      },
    ],
  } satisfies NewFeedInput);
}

youtubeFeedTest('shows the channel avatar in the sidebar and the video description in the reader', async ({ launchApp }) => {
  // Arrange
  const page = await launchApp();

  // Act: no Refresh click here — the items already arrived over IPC.
  await subscribeYoutube(page);
  await expect(page.getByText('A Video', { exact: true })).toBeVisible();

  // Assert: the sidebar shows the channel's own avatar, not a generic favicon. The category
  // folder starts collapsed, so it must be opened before the feed row renders. The name is
  // anchored because the river card below also names "Local Channel", in its own aria-label.
  await page.getByRole('button', { name: 'tech', exact: true }).click();
  const feedRow = page.getByRole('button', { name: /^Local Channel,/ });
  await expect(feedRow.locator('img')).toHaveAttribute('src', ICON_URL);

  // Act: open the video in the reader.
  await page.getByText('A Video', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A Video' })).toBeVisible();

  // Assert: the badge names the source type, the description shows with its line break and a
  // clickable link, and nothing tries to report a missing article.
  await expect(page.getByText('YOUTUBE', { exact: true })).toBeVisible();
  await expect(page.getByTestId('article-body')).toContainText('Full video notes.');
  await expect(page.getByTestId('article-body').getByRole('link', { name: 'https://example.com/more' })).toBeVisible();
  await expect(page.getByText('The full article could not be loaded', { exact: false })).toHaveCount(0);
});
