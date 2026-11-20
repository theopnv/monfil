// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import fs from 'node:fs/promises';
import { dialog } from 'electron';
import type { ExportOpmlError } from '../../shared/contracts';
import { queryFeedSummaries, queryWorkspaceById } from '../db/crud/query';
import { fail, ok, type Result } from '../../shared/result';
import { generateWorkspaceOpml, type OpmlCategoryInput } from './generate';

export async function exportWorkspaceOpml(workspaceId: number): Promise<Result<void, ExportOpmlError>> {
  const workspace = await queryWorkspaceById(workspaceId);
  if (!workspace) {
    return fail('WORKSPACE_NOT_FOUND', `No workspace found with id ${workspaceId}`);
  }

  const feeds = await queryFeedSummaries(workspaceId);
  // OPML 2.0 needs at least one outline in the body, so an empty workspace has no valid file.
  if (feeds.length === 0) {
    return fail('NO_FEEDS', 'This workspace has no feeds to export.');
  }
  const categoriesByName = new Map<string, OpmlCategoryInput>();
  for (const feed of feeds) {
    const category: OpmlCategoryInput = categoriesByName.get(feed.category.name) ?? { name: feed.category.name, feeds: [] };
    category.feeds.push({ title: feed.title, xmlUrl: feed.link });
    categoriesByName.set(feed.category.name, category);
  }

  const xml = generateWorkspaceOpml(workspace.name, [...categoriesByName.values()]);

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${workspace.name}.opml`,
    filters: [{ name: 'OPML', extensions: ['opml'] }],
  });
  if (canceled || !filePath) {
    return fail('CANCELLED', 'Export cancelled.');
  }

  try {
    await fs.writeFile(filePath, xml, 'utf-8');
    return ok();
  } catch (error) {
    return fail('FS_ERROR', error instanceof Error ? error.message : 'Could not write the file.');
  }
}
