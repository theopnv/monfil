import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { HOME_WORKSPACE_ID } from '../db/types';
import { rssSource } from '../feed/sources/rss';
import type { ParsedSource } from '../feed/sources/types';
import { importOpml, startOpmlImport } from './import';

vi.mock(import('../feed/sources/rss'), () => ({ rssSource: { type: 'rss' as const, fetchesFullArticle: false, fetch: vi.fn(), parse: vi.fn() } }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedFetchFeed = vi.mocked(rssSource.fetch);

function opml(body: string, headTitle = 'My feeds'): string {
  return `<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>${headTitle}</title></head><body>${body}</body></opml>`;
}

function parsed(link: string): ParsedSource {
  return { type: 'rss', link, title: 'Fetched title', description: '', items: [], icon: undefined };
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(() => {
  mockedFetchFeed.mockImplementation((link: string) => Promise.resolve({ success: true, data: parsed(link) }));
});

afterEach(async () => {
  mockedFetchFeed.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

describe('importOpml', () => {
  test('returns the parse error and writes nothing for a malformed document', async () => {
    // Act
    const result = await importOpml('not xml <<<', { kind: 'merge-workspace', workspaceId: HOME_WORKSPACE_ID });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'MALFORMED_XML', message: expect.any(String) } });
    expect(await db.selectFrom('feedMetadata').selectAll().execute()).toEqual([]);
  });

  test('creates a workspace, its categories and its feed placements', async () => {
    // Arrange
    const xml = opml(`
      <outline text="Tech">
        <outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/>
        <outline type="rss" text="Feed B" xmlUrl="https://b.example/feed"/>
      </outline>
    `);

    // Act
    const result = await importOpml(xml, { kind: 'new-workspace', name: 'CI/CD watch', icon: 'Code01', color: '#3b82f6' });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toEqual({ workspaceId: expect.any(Number), imported: 2, skipped: [], failed: [] });

    const workspace = await db.selectFrom('workspace').selectAll().where('id', '=', result.data.workspaceId).executeTakeFirstOrThrow();
    expect(workspace.name).toBe('CI/CD watch');

    const categories = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', result.data.workspaceId).execute();
    expect(categories.map((category) => category.name)).toEqual(['Tech']);

    const placements = await db.selectFrom('feedPlacement').selectAll().where('workspace_id', '=', result.data.workspaceId).execute();
    expect(placements).toHaveLength(2);
  });

  test('falls back to the document title when the given workspace name is blank', async () => {
    // Arrange
    const xml = opml('<outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/>', 'From the file');

    // Act
    const result = await importOpml(xml, { kind: 'new-workspace', name: '', icon: 'Code01', color: '#3b82f6' });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const workspace = await db.selectFrom('workspace').selectAll().where('id', '=', result.data.workspaceId).executeTakeFirstOrThrow();
    expect(workspace.name).toBe('From the file');
  });

  test('merging into a workspace skips a feed already placed there and reports it', async () => {
    // Arrange
    await db.insertInto('feedCategory').values({ name: 'Existing', workspace_id: HOME_WORKSPACE_ID }).execute();
    const category = await db.selectFrom('feedCategory').selectAll().where('name', '=', 'Existing').executeTakeFirstOrThrow();
    const existingFeed = await db.insertInto('feedMetadata').values({ link: 'https://a.example/feed', title: 'Feed A' }).returningAll().executeTakeFirstOrThrow();
    await db.insertInto('feedPlacement').values({ feed_id: existingFeed.id, category_id: category.id, workspace_id: HOME_WORKSPACE_ID, showInWorkspace: 1 }).execute();

    const xml = opml(`
      <outline text="Existing">
        <outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/>
        <outline type="rss" text="Feed B" xmlUrl="https://b.example/feed"/>
      </outline>
    `);

    // Act
    const result = await importOpml(xml, { kind: 'merge-workspace', workspaceId: HOME_WORKSPACE_ID });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.workspaceId).toBe(HOME_WORKSPACE_ID);
    expect(result.data.imported).toBe(1);
    expect(result.data.skipped).toEqual([{ title: 'Feed A', reason: 'Already in this workspace' }]);
  });

  test('merging into a workspace reuses an existing category with the same name instead of duplicating it', async () => {
    // Arrange
    await db.insertInto('feedCategory').values({ name: 'Existing', workspace_id: HOME_WORKSPACE_ID }).execute();
    const xml = opml('<outline text="Existing"><outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/></outline>');

    // Act
    const result = await importOpml(xml, { kind: 'merge-workspace', workspaceId: HOME_WORKSPACE_ID });

    // Assert
    expect(result.success).toBe(true);
    const categories = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', HOME_WORKSPACE_ID).where('name', '=', 'Existing').execute();
    expect(categories).toHaveLength(1);
  });

  test('merging into a non-Home workspace only dedupes against that workspace, not Home', async () => {
    // Arrange: the feed already sits in Home, but the import targets a different workspace.
    const otherWorkspace = await db.insertInto('workspace').values({ name: 'CI/CD watch', icon: 'Code01', color: '#3b82f6', position: 1 }).returningAll().executeTakeFirstOrThrow();
    await db.insertInto('feedCategory').values({ name: 'Existing', workspace_id: HOME_WORKSPACE_ID }).execute();
    const category = await db.selectFrom('feedCategory').selectAll().where('name', '=', 'Existing').executeTakeFirstOrThrow();
    const existingFeed = await db.insertInto('feedMetadata').values({ link: 'https://a.example/feed', title: 'Feed A' }).returningAll().executeTakeFirstOrThrow();
    await db.insertInto('feedPlacement').values({ feed_id: existingFeed.id, category_id: category.id, workspace_id: HOME_WORKSPACE_ID, showInWorkspace: 1 }).execute();

    const xml = opml('<outline text="Tech"><outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/></outline>');

    // Act
    const result = await importOpml(xml, { kind: 'merge-workspace', workspaceId: otherWorkspace.id });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.imported).toBe(1);
    expect(result.data.skipped).toEqual([]);
  });

  test('records a feed that fails its post-import refresh as failed', async () => {
    // Arrange
    mockedFetchFeed.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const xml = opml('<outline text="Tech"><outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/></outline>');

    // Act
    const result = await importOpml(xml, { kind: 'new-workspace', name: 'Pack', icon: 'Code01', color: '#3b82f6' });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.failed).toEqual([{ title: 'Feed A', message: 'offline' }]);
  });
});

describe('startOpmlImport', () => {
  test('returns the write summary before refresh completes', async () => {
    // Arrange
    let finishRefresh: ((result: Awaited<ReturnType<typeof rssSource.fetch>>) => void) | undefined;
    mockedFetchFeed.mockReturnValue(new Promise((resolve) => {
      finishRefresh = resolve;
    }));
    const xml = opml('<outline text="Tech"><outline type="rss" text="Feed A" xmlUrl="https://a.example/feed"/></outline>');

    // Act
    const result = await startOpmlImport(xml, { kind: 'new-workspace', name: 'Pack', icon: 'Code01', color: '#3b82f6' });

    // Assert
    expect(result).toMatchObject({
      success: true,
      data: { summary: { imported: 1, skipped: [], failed: [] } },
    });
    if (!result.success || !finishRefresh) {
      return;
    }
    finishRefresh({ success: true, data: parsed('https://a.example/feed') });
    await expect(result.data.completion).resolves.toMatchObject({ imported: 1, failed: [] });
  });
});
