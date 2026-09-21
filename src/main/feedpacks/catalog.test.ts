import { describe, expect, test, vi } from 'vitest';
import { createCatalogService } from './catalog';

const bundledCatalog = JSON.stringify({
  version: 1,
  packs: [{
    slug: 'modern-software-delivery',
    title: 'Modern Software Delivery',
    description: 'Watch delivery tools.',
    tags: ['ci-cd'],
    curator: 'Monfil',
    sourceCount: 1,
    updatedAt: '2026-03-01',
    opml: 'modern-software-delivery.opml',
  }],
});

function service(overrides: Partial<Parameters<typeof createCatalogService>[0]> = {}) {
  return createCatalogService({
    fetch: vi.fn(),
    readFile: vi.fn(async () => bundledCatalog),
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    cachePath: 'cache/index.json',
    bundledPath: 'feedpacks/index.json',
    ...overrides,
  });
}

describe('catalog', () => {
  test('returns and caches a fetched catalog', async () => {
    // Arrange
    const fetch = vi.fn(async () => ({ success: true as const, data: bundledCatalog }));
    const writeFile = vi.fn(async () => undefined);
    const catalog = service({ fetch, writeFile });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({ success: true, data: JSON.parse(bundledCatalog) });
    expect(writeFile).toHaveBeenCalledWith('cache/index.json', bundledCatalog, 'utf-8');
  });

  test('uses the bundled catalog when the network request fails', async () => {
    // Arrange
    const catalog = service({
      fetch: vi.fn(async () => ({ success: false as const, error: { name: 'NETWORK_ERROR' as const, message: 'offline' } })),
      readFile: vi.fn(async (path: string) => {
        if (path === 'cache/index.json') {
          throw new Error('missing');
        }
        return bundledCatalog;
      }),
    });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({ success: true, data: JSON.parse(bundledCatalog) });
  });

  test('uses the bundled catalog in development without a network request', async () => {
    // Arrange
    const fetch = vi.fn();
    const catalog = service({ fetch, preferBundled: true });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({ success: true, data: JSON.parse(bundledCatalog) });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rejects an unknown catalog version', async () => {
    // Arrange
    const catalog = service({ fetch: vi.fn(async () => ({ success: true as const, data: '{"version":2,"packs":[]}' })) });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({
      success: false,
      error: { name: 'UNSUPPORTED_VERSION', message: 'This version of Monfil cannot read feedpack catalog version 2.' },
    });
  });
});
