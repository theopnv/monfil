// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../lib/fetch';
import type { Feedpack, FeedpackError, FeedpackInstallTarget, FeedpackPreview, ImportOpmlTarget, ImportSummary, InstallFeedpackError } from '../../shared/contracts';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import { mainLanguage } from '../lib/i18n';
import { feedpackText } from '../../shared/i18n/feedpack-text';
import { fail, type Result } from '../../shared/result';
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
    return fail('PACK_NOT_FOUND', `The feedpack "${slug}" does not exist.`, { slug });
  }
  if (usesBundledFeedpacks()) {
    try {
      return { success: true, data: { pack, xml: await readBundledFeedpack(pack) } };
    } catch {
      return fail('FETCH_ERROR', `Could not read local ${pack.title}.`, { reason: 'local', title: feedpackText(pack, mainLanguage()).title });
    }
  }
  const fetched = await fetchText(feedpackOpmlUrl(pack));
  if (fetched.success) {
    return { success: true, data: { pack, xml: fetched.data.body } };
  }
  try {
    return { success: true, data: { pack, xml: await readBundledFeedpack(pack) } };
  } catch {
    return fail('FETCH_ERROR', `Could not fetch ${pack.title}.`, { reason: 'remote', title: feedpackText(pack, mainLanguage()).title });
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
      name: target.name.trim() || feedpackText(loaded.data.pack, mainLanguage()).title,
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
      failed: [{ title: feedpackText(loaded.data.pack, mainLanguage()).title, message: error instanceof Error ? error.message : 'Could not refresh the imported feeds.' }],
    }),
  );
  return { success: true, data: started.data.summary };
}

const CATALOG_VERSION = 1;
