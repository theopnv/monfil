import { describe, expect, test, vi } from 'vitest';
import type { Feedpack } from '../../shared/contracts';
import { fetchUrl } from '../lib/fetch';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { startOpmlImport } from '../opml/import';
import { getFeedpackCatalog, readBundledFeedpack, usesBundledFeedpacks } from './catalog';
import { installFeedpack, previewFeedpack } from './install';

vi.mock(import('../lib/fetch'), () => ({ fetchUrl: vi.fn() }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ broadcastToRenderers: vi.fn() }));
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
    expect(fetchUrl).not.toHaveBeenCalled();
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
