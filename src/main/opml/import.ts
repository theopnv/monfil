import fs from 'node:fs/promises';
import { dialog } from 'electron';
import type { ImportFailed, ImportOpmlError, ImportOpmlTarget, ImportSkipped, ImportSummary } from '../../shared/contracts';
import { db, dbReady } from '../db/database';
import { queryFeedMetadataByIds } from '../db/crud/query';
import type { Result } from '../../shared/result';
import { refreshFeeds } from '../feed/refresh';
import { parseOpmlDocument } from './parse';

export interface StartedOpmlImport {
  summary: ImportSummary;
  completion: Promise<ImportSummary>;
}

/**
 * Parses an OPML document and writes its workspace, categories, and feed placements in one
 * transaction. Refresh starts after the transaction and is exposed separately to callers that do
 * not need to wait for fetched items.
 * @param xml the raw OPML document
 * @param target where to install it: a brand new workspace, or merged into an existing one
 */
export async function startOpmlImport(
  xml: string,
  target: ImportOpmlTarget,
): Promise<Result<StartedOpmlImport, ImportOpmlError>> {
  const parsed = parseOpmlDocument(xml);
  if (!parsed.success) {
    return parsed;
  }

  await dbReady;
  try {
    const { workspaceId, insertedFeedIds, skipped } = await db.transaction().execute(async (trx) => {
      let workspaceId: number;
      if (target.kind === 'new-workspace') {
        const { maxPosition } = await trx.selectFrom('workspace').select((eb) => eb.fn.max('position').as('maxPosition')).executeTakeFirstOrThrow();
        const workspace = await trx.insertInto('workspace')
          .values({
            name: target.name || parsed.data.title,
            icon: target.icon,
            color: target.color,
            position: (maxPosition ?? -1) + 1,
            source_slug: target.sourceSlug,
            source_version: target.sourceVersion,
            installed_at: target.sourceSlug ? new Date().toISOString() : undefined,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        workspaceId = workspace.id;
      } else {
        workspaceId = target.workspaceId;
      }

      // Only merging into an existing workspace can collide with a feed already placed there; a
      // brand new workspace starts empty by definition.
      const existingLinks = target.kind === 'merge-workspace'
        ? new Set((await trx.selectFrom('feedPlacement')
          .innerJoin('feedMetadata', 'feedMetadata.id', 'feedPlacement.feed_id')
          .select('feedMetadata.link')
          .where('feedPlacement.workspace_id', '=', target.workspaceId)
          .execute()).map((row) => row.link))
        : new Set<string>();

      const skipped: ImportSkipped[] = [];
      const insertedFeedIds: number[] = [];

      for (const category of parsed.data.categories) {
        const categoryRow = await trx.insertInto('feedCategory')
          .values({ name: category.name, workspace_id: workspaceId })
          .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
          .returningAll()
          .executeTakeFirstOrThrow();

        for (const feed of category.feeds) {
          if (existingLinks.has(feed.xmlUrl)) {
            skipped.push({ title: feed.title, reason: 'Already in this workspace' });
            continue;
          }

          const metadata = await trx.insertInto('feedMetadata')
            .values({ link: feed.xmlUrl, title: feed.title, type: feed.type })
            .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({ title: eb.ref('excluded.title') })))
            .returningAll()
            .executeTakeFirstOrThrow();

          await trx.insertInto('feedPlacement')
            .values({ feed_id: metadata.id, category_id: categoryRow.id, workspace_id: workspaceId, showInWorkspace: 1 })
            .onConflict((oc) => oc.columns(['feed_id', 'workspace_id']).doUpdateSet((eb) => ({
              category_id: eb.ref('excluded.category_id'),
              showInWorkspace: eb.ref('excluded.showInWorkspace'),
            })))
            .execute();

          insertedFeedIds.push(metadata.id);
        }
      }

      return { workspaceId, insertedFeedIds, skipped };
    });

    const summary: ImportSummary = { workspaceId, imported: insertedFeedIds.length, skipped, failed: [] };
    const completion = refreshFeeds(insertedFeedIds).then(async () => {
      const refreshed = await queryFeedMetadataByIds(insertedFeedIds);
      const failed: ImportFailed[] = refreshed.flatMap((feed) => (feed.last_error ? [{ title: feed.title, message: feed.last_error }] : []));
      return { ...summary, failed };
    });

    return { success: true, data: { summary, completion } };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

export async function importOpml(xml: string, target: ImportOpmlTarget): Promise<Result<ImportSummary, ImportOpmlError>> {
  const started = await startOpmlImport(xml, target);
  if (!started.success) {
    return started;
  }
  try {
    return { success: true, data: await started.data.completion };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Asks the user for an OPML file, then hands it to {@link importOpml}. Separate from that function
 * so the parsing and merge-rule logic stays testable without an Electron dialog in the loop.
 * @param target where to install the picked file
 */
export async function openAndImportOpml(target: ImportOpmlTarget): Promise<Result<ImportSummary, ImportOpmlError>> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
    properties: ['openFile'],
  });
  const filePath = filePaths[0];
  if (canceled || !filePath) {
    return { success: false, error: { name: 'CANCELLED', message: 'Import cancelled.' } };
  }

  let xml: string;
  try {
    xml = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return { success: false, error: { name: 'FS_ERROR', message: error instanceof Error ? error.message : 'Could not read the file.' } };
  }

  return importOpml(xml, target);
}
