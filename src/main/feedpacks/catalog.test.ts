// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { createCatalogService, feedpackOpmlUrl } from './catalog';

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

  test('does not cache a fetched catalog that has an invalid shape', async () => {
    // Arrange
    const writeFile = vi.fn(async () => undefined);
    const catalog = service({ fetch: vi.fn(async () => ({ success: true as const, data: '{"version":1,"packs":"nope"}' })), writeFile });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('returns a fetched catalog even when its cache cannot be written', async () => {
    // Arrange
    const catalog = service({
      fetch: vi.fn(async () => ({ success: true as const, data: bundledCatalog })),
      mkdir: vi.fn(async () => {
        throw new Error('read-only');
      }),
    });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({ success: true, data: JSON.parse(bundledCatalog) });
  });

  test('rejects a fetched body that is not JSON', async () => {
    // Arrange
    const catalog = service({ fetch: vi.fn(async () => ({ success: true as const, data: '<html>' })) });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'INVALID_CATALOG', message: 'The feedpack catalog is not valid JSON.' } });
  });

  test.each([
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"catalog"'],
  ])('rejects a catalog root that is %s', async (_label, body) => {
    // Arrange
    const catalog = service({ fetch: vi.fn(async () => ({ success: true as const, data: body })) });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
  });

  describe('pack validation', () => {
    const validPack = JSON.parse(bundledCatalog).packs[0] as Record<string, unknown>;

    async function load(packs: unknown) {
      const writeFile = vi.fn(async () => undefined);
      const result = await service({
        fetch: vi.fn(async () => ({ success: true as const, data: JSON.stringify({ version: 1, packs }) })),
        writeFile,
      }).get();
      return { result, writeFile };
    }

    test.each([
      ['slug', 5],
      ['title', 5],
      ['description', 5],
      ['tags', 'ci-cd'],
      ['curator', 5],
      ['sourceCount', '1'],
      ['updatedAt', 5],
      ['opml', 5],
    ])('rejects a pack whose %s has the wrong type', async (field, value) => {
      // Act
      const { result, writeFile } = await load([{ ...validPack, [field]: value }]);

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
      expect(writeFile).not.toHaveBeenCalled();
    });

    test.each(['slug', 'title', 'description', 'tags', 'curator', 'sourceCount', 'updatedAt', 'opml'])('rejects a pack with no %s', async (field) => {
      // Arrange
      const incomplete = { ...validPack };
      Reflect.deleteProperty(incomplete, field);

      // Act
      const { result } = await load([incomplete]);

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    });

    test('rejects a pack whose tag list holds one value that is not a string', async () => {
      // Act
      const { result } = await load([{ ...validPack, tags: ['ci-cd', 7] }]);

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    });

    test.each([
      ['null', null],
      ['a string', 'pack'],
      ['a number', 3],
    ])('rejects a pack list that holds %s', async (_label, entry) => {
      // Act
      const { result } = await load([validPack, entry]);

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    });

    test('rejects the whole catalog when only one pack in the list is invalid', async () => {
      // Act
      const { result } = await load([validPack, { ...validPack, slug: 9 }]);

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    });

    test('accepts an empty pack list and a pack with no tags', async () => {
      // Act
      const empty = await load([]);
      const untagged = await load([{ ...validPack, tags: [] }]);

      // Assert
      expect(empty.result).toEqual({ success: true, data: { version: 1, packs: [] } });
      expect(untagged.result).toEqual({ success: true, data: { version: 1, packs: [{ ...validPack, tags: [] }] } });
    });
  });

  describe('when the network request fails', () => {
    const offline = vi.fn(async () => ({ success: false as const, error: { name: 'NETWORK_ERROR' as const, message: 'offline' } }));
    const emptyCatalog = JSON.stringify({ version: 1, packs: [] });

    test('prefers the cached catalog over the bundled one', async () => {
      // Arrange
      const catalog = service({
        fetch: offline,
        readFile: vi.fn(async (path: string) => (path === 'cache/index.json' ? emptyCatalog : bundledCatalog)),
      });

      // Act
      const result = await catalog.get();

      // Assert
      expect(result).toEqual({ success: true, data: { version: 1, packs: [] } });
    });

    test('uses the bundled catalog when the cached one is invalid', async () => {
      // Arrange
      const catalog = service({
        fetch: offline,
        readFile: vi.fn(async (path: string) => (path === 'cache/index.json' ? '{"version":2,"packs":[]}' : bundledCatalog)),
      });

      // Act
      const result = await catalog.get();

      // Assert
      expect(result).toEqual({ success: true, data: JSON.parse(bundledCatalog) });
    });

    test('reports the catalog as unavailable when neither the cache nor the bundle can be read', async () => {
      // Arrange
      const catalog = service({
        fetch: offline,
        readFile: vi.fn(async () => {
          throw new Error('missing');
        }),
      });

      // Act
      const result = await catalog.get();

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'UNAVAILABLE' } });
    });

    test('rejects a bundled catalog that is not valid', async () => {
      // Arrange
      const catalog = service({
        fetch: offline,
        readFile: vi.fn(async (path: string) => {
          if (path === 'cache/index.json') {
            throw new Error('missing');
          }
          return 'not json';
        }),
      });

      // Act
      const result = await catalog.get();

      // Assert
      expect(result).toMatchObject({ success: false, error: { name: 'INVALID_CATALOG' } });
    });
  });

  test('reports the catalog as unavailable in development when the bundle cannot be read', async () => {
    // Arrange
    const catalog = service({
      preferBundled: true,
      readFile: vi.fn(async () => {
        throw new Error('missing');
      }),
    });

    // Act
    const result = await catalog.get();

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'UNAVAILABLE' } });
  });
});

describe('feedpackOpmlUrl', () => {
  test('points at the pack file in the repository and escapes its name', () => {
    // Act
    const url = feedpackOpmlUrl({ ...JSON.parse(bundledCatalog).packs[0], opml: 'a b/c.opml' });

    // Assert
    expect(url).toBe('https://raw.githubusercontent.com/theopnv/monfil/main/feedpacks/a%20b%2Fc.opml');
  });
});
