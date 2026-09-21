import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { CatalogError, Feedpack, FeedpackCatalog, FetchUrlError } from '../../shared/contracts';
import { fetchUrl } from '../lib/fetch';
import type { Result } from '../../shared/result';

const CATALOG_URL = 'https://raw.githubusercontent.com/theopnv/monfil/main/feedpacks/index.json';
const CATALOG_VERSION = 1;

export interface CatalogDependencies {
  fetch: (url: string) => Promise<Result<string, FetchUrlError>>;
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
  writeFile: (path: string, data: string, encoding: BufferEncoding) => Promise<void>;
  mkdir: (path: string, options: { recursive: true }) => Promise<string | undefined>;
  cachePath: string;
  bundledPath: string;
  preferBundled?: boolean;
}

function isFeedpack(value: unknown): value is Feedpack {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const pack = value as Record<string, unknown>;
  return typeof pack['slug'] === 'string'
    && typeof pack['title'] === 'string'
    && typeof pack['description'] === 'string'
    && Array.isArray(pack['tags'])
    && pack['tags'].every((tag) => typeof tag === 'string')
    && typeof pack['curator'] === 'string'
    && typeof pack['sourceCount'] === 'number'
    && typeof pack['updatedAt'] === 'string'
    && typeof pack['opml'] === 'string';
}

function parseCatalog(text: string): Result<FeedpackCatalog, CatalogError> {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { success: false, error: { name: 'INVALID_CATALOG', message: 'The feedpack catalog is not valid JSON.' } };
  }

  if (typeof document !== 'object' || document === null) {
    return { success: false, error: { name: 'INVALID_CATALOG', message: 'The feedpack catalog has an invalid shape.' } };
  }
  const catalog = document as Record<string, unknown>;
  if (catalog['version'] !== CATALOG_VERSION) {
    return {
      success: false,
      error: { name: 'UNSUPPORTED_VERSION', message: `This version of Monfil cannot read feedpack catalog version ${String(catalog['version'])}.` },
    };
  }
  if (!Array.isArray(catalog['packs']) || !catalog['packs'].every(isFeedpack)) {
    return { success: false, error: { name: 'INVALID_CATALOG', message: 'The feedpack catalog has an invalid shape.' } };
  }
  return { success: true, data: { version: CATALOG_VERSION, packs: catalog['packs'] } };
}

export function createCatalogService(dependencies: CatalogDependencies): { get: () => Promise<Result<FeedpackCatalog, CatalogError>> } {
  async function bundled(): Promise<Result<FeedpackCatalog, CatalogError>> {
    try {
      return parseCatalog(await dependencies.readFile(dependencies.bundledPath, 'utf-8'));
    } catch {
      return { success: false, error: { name: 'UNAVAILABLE', message: 'The bundled feedpack catalog is unavailable.' } };
    }
  }

  async function fallback(): Promise<Result<FeedpackCatalog, CatalogError>> {
    try {
      const parsed = parseCatalog(await dependencies.readFile(dependencies.cachePath, 'utf-8'));
      if (parsed.success) {
        return parsed;
      }
    } catch {
      // A missing cache must not prevent use of the bundled catalog.
    }
    return bundled();
  }

  return {
    async get() {
      if (dependencies.preferBundled) {
        return bundled();
      }
      const fetched = await dependencies.fetch(CATALOG_URL);
      if (!fetched.success) {
        return fallback();
      }
      const parsed = parseCatalog(fetched.data);
      if (!parsed.success) {
        return parsed;
      }
      try {
        await dependencies.mkdir(path.dirname(dependencies.cachePath), { recursive: true });
        await dependencies.writeFile(dependencies.cachePath, fetched.data, 'utf-8');
      } catch {
        // The current catalog remains useful when its cache cannot be written.
      }
      return parsed;
    },
  };
}

function bundledCatalogPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'feedpacks', 'index.json')
    : path.join(app.getAppPath(), 'feedpacks', 'index.json');
}

let catalog: ReturnType<typeof createCatalogService> | undefined;

/** Loads the remote catalog only when the pack browser requests it. */
export function getFeedpackCatalog(): Promise<Result<FeedpackCatalog, CatalogError>> {
  catalog ??= createCatalogService({
    fetch: fetchUrl,
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    mkdir: fs.mkdir,
    cachePath: path.join(app.getPath('userData'), 'feedpacks', 'index.json'),
    bundledPath: bundledCatalogPath(),
    preferBundled: !app.isPackaged,
  });
  return catalog.get();
}

export function feedpackOpmlUrl(pack: Feedpack): string {
  return `https://raw.githubusercontent.com/theopnv/monfil/main/feedpacks/${encodeURIComponent(pack.opml)}`;
}

export function usesBundledFeedpacks(): boolean {
  return !app.isPackaged;
}

export function readBundledFeedpack(pack: Feedpack): Promise<string> {
  return fs.readFile(path.join(path.dirname(bundledCatalogPath()), pack.opml), 'utf-8');
}
