import { fetchText } from '../lib/fetch';
import type { Feedpack, FeedpackError, FeedpackInstallTarget, FeedpackPreview, ImportOpmlTarget, ImportSummary, InstallFeedpackError } from '../../shared/contracts';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import type { Result } from '../../shared/result';
import { startOpmlImport } from '../opml/import';
import { parseOpmlDocument } from '../opml/parse';
import { feedpackOpmlUrl, getFeedpackCatalog, readBundledFeedpack, usesBundledFeedpacks } from './catalog';

async function loadFeedpack(slug: string): Promise<Result<{ pack: Feedpack; xml: string }, FeedpackError>> {
  const catalog = await getFeedpackCatalog();
  if (!catalog.success) {
    return catalog;
  }
  const pack = catalog.data.packs.find((candidate) => candidate.slug === slug);
  if (!pack) {
    return { success: false, error: { name: 'PACK_NOT_FOUND', message: `The feedpack "${slug}" does not exist.` } };
  }
  if (usesBundledFeedpacks()) {
    try {
      return { success: true, data: { pack, xml: await readBundledFeedpack(pack) } };
    } catch {
      return { success: false, error: { name: 'FETCH_ERROR', message: `Could not read local ${pack.title}.` } };
    }
  }
  const fetched = await fetchText(feedpackOpmlUrl(pack));
  if (fetched.success) {
    return { success: true, data: { pack, xml: fetched.data.body } };
  }
  try {
    return { success: true, data: { pack, xml: await readBundledFeedpack(pack) } };
  } catch {
    return { success: false, error: { name: 'FETCH_ERROR', message: `Could not fetch ${pack.title}.` } };
  }
}

export async function previewFeedpack(slug: string): Promise<Result<FeedpackPreview, FeedpackError>> {
  const loaded = await loadFeedpack(slug);
  if (!loaded.success) {
    return loaded;
  }
  const sources = parseOpmlDocument(loaded.data.xml);
  if (!sources.success) {
    return sources;
  }
  return { success: true, data: { pack: loaded.data.pack, sources: sources.data } };
}

export async function installFeedpack(
  slug: string,
  target: FeedpackInstallTarget,
): Promise<Result<ImportSummary, InstallFeedpackError>> {
  const loaded = await loadFeedpack(slug);
  if (!loaded.success) {
    return loaded;
  }

  const opmlTarget: ImportOpmlTarget = target.kind === 'merge-workspace'
    ? target
    : {
      kind: 'new-workspace',
      name: target.name.trim() || loaded.data.pack.title,
      icon: target.icon,
      color: target.color,
      sourceSlug: loaded.data.pack.slug,
      sourceVersion: String(CATALOG_VERSION),
    };
  const started = await startOpmlImport(loaded.data.xml, opmlTarget);
  if (!started.success) {
    return started;
  }

  void started.data.completion.then(
    (summary) => broadcastToRenderers('feedpacks:install-finished', {
      workspaceId: summary.workspaceId,
      imported: summary.imported,
      failed: summary.failed,
    }),
    (error: unknown) => broadcastToRenderers('feedpacks:install-finished', {
      workspaceId: started.data.summary.workspaceId,
      imported: started.data.summary.imported,
      failed: [{ title: loaded.data.pack.title, message: error instanceof Error ? error.message : 'Could not refresh the imported feeds.' }],
    }),
  );
  return { success: true, data: started.data.summary };
}

const CATALOG_VERSION = 1;
