// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Feedpack } from '../../shared/contracts';
import { fetchText } from '../lib/fetch';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import { startOpmlImport } from '../opml/import';
import { feedpackOpmlUrl, getFeedpackCatalog, readBundledFeedpack, usesBundledFeedpacks } from './catalog';
import { installFeedpack, previewFeedpack } from './install';

vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('../lib/sendToRenderer'), () => ({ broadcastToRenderers: vi.fn() }));
vi.mock(import('../opml/import'), () => ({ startOpmlImport: vi.fn() }));
vi.mock(import('./catalog'), () => ({
  getFeedpackCatalog: vi.fn(),
  readBundledFeedpack: vi.fn(),
  usesBundledFeedpacks: vi.fn(),
  feedpackOpmlUrl: vi.fn(),
}));

const pack: Feedpack = {
  slug: 'devsecops-watch',
  title: 'DevSecOps Watch',
  description: 'Testing and delivery sources.',
  tags: ['devsecops'],
  curator: 'Monfil',
  sourceCount: 1,
  updatedAt: '2026-09-21',
  opml: 'devsecops-watch.opml',
};

const feedXml = '<?xml version="1.0"?><opml><head><title>DevSecOps Watch</title></head><body><outline text="Engineering"><outline text="Source" xmlUrl="https://example.com/feed"/></outline></body></opml>';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('previewFeedpack', () => {
  test('reads the local OPML in development', async () => {
    // Arrange
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue('<?xml version="1.0"?><opml><head><title>DevSecOps Watch</title></head><body><outline text="Engineering"><outline text="Source" xmlUrl="https://example.com/feed"/></outline></body></opml>');

    // Act
    const result = await previewFeedpack(pack.slug);

    // Assert
    expect(result).toMatchObject({
      success: true,
      data: { pack, sources: { categories: [{ name: 'Engineering' }] } },
    });
    expect(fetchText).not.toHaveBeenCalled();
  });

  test('imports into the selected workspace without creating another', async () => {
    // Arrange
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue('<?xml version="1.0"?><opml><head><title>DevSecOps Watch</title></head><body><outline text="Engineering"><outline text="Source" xmlUrl="https://example.com/feed"/></outline></body></opml>');
    vi.mocked(startOpmlImport).mockResolvedValue({
      success: true,
      data: {
        summary: { workspaceId: 2, imported: 1, skipped: [], failed: [] },
        completion: Promise.resolve({ workspaceId: 2, imported: 1, skipped: [], failed: [] }),
      },
    });

    // Act
    await installFeedpack(pack.slug, { kind: 'merge-workspace', workspaceId: 2 });

    // Assert
    expect(startOpmlImport).toHaveBeenCalledWith(expect.any(String), { kind: 'merge-workspace', workspaceId: 2 });
  });

  test('owns the feedpack completion event', async () => {
    // Arrange
    const completion = Promise.resolve({ workspaceId: 3, imported: 1, skipped: [], failed: [] });
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue('<?xml version="1.0"?><opml><head><title>DevSecOps Watch</title></head><body><outline text="Engineering"><outline text="Source" xmlUrl="https://example.com/feed"/></outline></body></opml>');
    vi.mocked(startOpmlImport).mockResolvedValue({
      success: true,
      data: {
        summary: { workspaceId: 3, imported: 1, skipped: [], failed: [] },
        completion,
      },
    });

    // Act
    await installFeedpack(pack.slug, { kind: 'new-workspace', name: '', icon: 'Code01', color: '#d67f48' });
    await completion;

    // Assert
    expect(broadcastToRenderers).toHaveBeenCalledWith('feedpacks:install-finished', {
      workspaceId: 3,
      imported: 1,
      failed: [],
    });
  });
});

describe('loading a feedpack', () => {
  test('reports an unknown slug without importing anything', async () => {
    // Arrange
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });

    // Act
    const installed = await installFeedpack('other-pack', { kind: 'merge-workspace', workspaceId: 2 });
    const previewed = await previewFeedpack('other-pack');

    // Assert
    const expected = { success: false, error: { name: 'PACK_NOT_FOUND', message: expect.stringContaining('other-pack') } };
    expect(installed).toEqual(expected);
    expect(previewed).toEqual(expected);
    expect(startOpmlImport).not.toHaveBeenCalled();
  });

  test('picks the pack that matches the slug among several', async () => {
    // Arrange
    const second = { ...pack, slug: 'second-pack', title: 'Second Pack' };
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack, second] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue(feedXml);

    // Act
    const result = await previewFeedpack('second-pack');

    // Assert
    expect(result).toMatchObject({ success: true, data: { pack: second } });
    expect(readBundledFeedpack).toHaveBeenCalledWith(second);
  });

  test('passes on a catalog error', async () => {
    // Arrange
    const error = { name: 'UNAVAILABLE' as const, message: 'The bundled feedpack catalog is unavailable.' };
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: false, error });

    // Act
    const result = await previewFeedpack(pack.slug);

    // Assert
    expect(result).toEqual({ success: false, error });
  });

  test('reports FETCH_ERROR when the local file cannot be read in development', async () => {
    // Arrange
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockRejectedValue(new Error('ENOENT'));

    // Act
    const result = await previewFeedpack(pack.slug);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'FETCH_ERROR', message: expect.stringContaining(pack.title) } });
    expect(fetchText).not.toHaveBeenCalled();
  });

  describe('in a packaged app', () => {
    beforeEach(() => {
      vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
      vi.mocked(usesBundledFeedpacks).mockReturnValue(false);
      vi.mocked(feedpackOpmlUrl).mockReturnValue('https://packs.example/devsecops-watch.opml');
    });

    test('fetches the OPML from the network and does not read the bundled copy', async () => {
      // Arrange
      vi.mocked(fetchText).mockResolvedValue({ success: true, data: { body: feedXml, validators: { etag: undefined, last_modified: undefined } } });

      // Act
      const result = await previewFeedpack(pack.slug);

      // Assert
      expect(result).toMatchObject({ success: true, data: { pack, sources: { categories: [{ name: 'Engineering' }] } } });
      expect(fetchText).toHaveBeenCalledWith('https://packs.example/devsecops-watch.opml');
      expect(readBundledFeedpack).not.toHaveBeenCalled();
    });

    test('falls back to the bundled copy when the fetch fails', async () => {
      // Arrange
      vi.mocked(fetchText).mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
      vi.mocked(readBundledFeedpack).mockResolvedValue(feedXml);

      // Act
      const result = await previewFeedpack(pack.slug);

      // Assert
      expect(result).toMatchObject({ success: true, data: { pack, sources: { categories: [{ name: 'Engineering' }] } } });
    });

    test('reports FETCH_ERROR when the fetch fails and the bundled copy cannot be read', async () => {
      // Arrange
      vi.mocked(fetchText).mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
      vi.mocked(readBundledFeedpack).mockRejectedValue(new Error('ENOENT'));

      // Act
      const result = await previewFeedpack(pack.slug);

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'FETCH_ERROR', message: expect.stringContaining(pack.title) } });
    });
  });

  test('passes on the parse error of a pack that holds no feeds', async () => {
    // Arrange
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue('<?xml version="1.0"?><opml><head><title>Empty</title></head><body></body></opml>');

    // Act
    const result = await previewFeedpack(pack.slug);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NO_FEEDS', message: expect.any(String) } });
  });
});

describe('installFeedpack', () => {
  const summary = { workspaceId: 3, imported: 1, skipped: [], failed: [] };

  function startWith(completion: Promise<typeof summary>) {
    vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: { version: 1, packs: [pack] } });
    vi.mocked(usesBundledFeedpacks).mockReturnValue(true);
    vi.mocked(readBundledFeedpack).mockResolvedValue(feedXml);
    vi.mocked(startOpmlImport).mockResolvedValue({ success: true, data: { summary, completion } });
  }

  test.each([
    ['a blank name', '', 'DevSecOps Watch'],
    ['a name of spaces', '   ', 'DevSecOps Watch'],
    ['a name with spaces around it', '  My pack  ', 'My pack'],
  ])('creates the workspace from %s', async (_label, name, expectedName) => {
    // Arrange
    startWith(Promise.resolve(summary));

    // Act
    const result = await installFeedpack(pack.slug, { kind: 'new-workspace', name, icon: 'Code01', color: '#d67f48' });

    // Assert
    expect(result).toEqual({ success: true, data: summary });
    expect(startOpmlImport).toHaveBeenCalledWith(feedXml, {
      kind: 'new-workspace',
      name: expectedName,
      icon: 'Code01',
      color: '#d67f48',
      sourceSlug: 'devsecops-watch',
      sourceVersion: '1',
    });
  });

  test('passes on a failed import and announces nothing', async () => {
    // Arrange
    const error = { name: 'DB_ERROR' as const, message: 'disk full' };
    startWith(Promise.resolve(summary));
    vi.mocked(startOpmlImport).mockResolvedValue({ success: false, error });

    // Act
    const result = await installFeedpack(pack.slug, { kind: 'merge-workspace', workspaceId: 2 });

    // Assert
    expect(result).toEqual({ success: false, error });
    expect(broadcastToRenderers).not.toHaveBeenCalled();
  });

  test.each([
    ['the error message', new Error('refresh crashed'), 'refresh crashed'],
    ['a default message for a value that is not an error', 'boom', 'Could not refresh the imported feeds.'],
  ])('announces the pack as failed with %s when the refresh rejects', async (_label, rejection, message) => {
    // Arrange
    const completion = Promise.reject<typeof summary>(rejection);
    startWith(completion);

    // Act
    await installFeedpack(pack.slug, { kind: 'new-workspace', name: '', icon: 'Code01', color: '#d67f48' });
    await completion.catch(() => undefined);
    await Promise.resolve();

    // Assert
    expect(broadcastToRenderers).toHaveBeenCalledWith('feedpacks:install-finished', {
      workspaceId: 3,
      imported: 1,
      failed: [{ title: 'DevSecOps Watch', message }],
    });
  });
});
