import fs from 'node:fs/promises';
import { dialog } from 'electron';
import { queryFeedSummaries, queryWorkspaceById } from '../db/crud/query';
import type { Result } from '../lib/utils';
import { generateWorkspaceOpml, type OpmlCategoryInput } from './generate';

export type ExportOpmlError =
  | { name: 'WORKSPACE_NOT_FOUND'; message: string }
  | { name: 'CANCELLED'; message: string }
  | { name: 'FS_ERROR'; message: string };

/**
 * Writes one workspace out as OPML, category by category, after asking the user where to save it.
 * @param workspaceId the workspace to export
 */
export async function exportWorkspaceOpml(workspaceId: number): Promise<Result<void, ExportOpmlError>> {
  const workspace = await queryWorkspaceById(workspaceId);
  if (!workspace) {
    return { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: `No workspace found with id ${workspaceId}` } };
  }

  const feeds = await queryFeedSummaries(workspaceId);
  const categoriesByName = new Map<string, OpmlCategoryInput>();
  for (const feed of feeds) {
    const category = categoriesByName.get(feed.category.name) ?? { name: feed.category.name, feeds: [] };
    category.feeds.push({ title: feed.title, xmlUrl: feed.link });
    categoriesByName.set(feed.category.name, category);
  }

  const xml = generateWorkspaceOpml(workspace.name, [...categoriesByName.values()]);

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${workspace.name}.opml`,
    filters: [{ name: 'OPML', extensions: ['opml'] }],
  });
  if (canceled || !filePath) {
    return { success: false, error: { name: 'CANCELLED', message: 'Export cancelled.' } };
  }

  try {
    await fs.writeFile(filePath, xml, 'utf-8');
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'FS_ERROR', message: error instanceof Error ? error.message : 'Could not write the file.' } };
  }
}
