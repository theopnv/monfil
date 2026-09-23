import { enrichItems } from "../feed/enrichItems";
import { logger } from '../logging/logger';
import { ARTICLE_FETCH_TIMEOUT_MS } from "../constants";
import { deriveArticleContentStatus } from "../feed/extractArticle";
import { extractArticleInUtilityProcess } from '../feed/extractArticleUtility';
import { resolveSource, sourceFor } from "../feed/sources/registry";
import { refreshAllFeeds } from "../feed/refresh";
import { rescheduleRefresh } from "../feed/scheduler";
import { fetchText } from "../lib/fetch";
import { addFeedToDatabase, createCategory, createWorkspace, updateFeedItemImage, upsertArticleContent } from "../db/crud/insert";
import { deleteCategory, deleteFeedFromDatabase, deleteWorkspace } from "../db/crud/delete";
import { moveFeedsToCategory, moveFeedToWorkspace, renameCategory, reorderWorkspaces, setFeedsShowInWorkspace, setFeedItemsRead, updateWorkspace } from "../db/crud/update";
import { queryArticleContent, queryFeedCategory, queryFeedItems, queryFeedMetadata, queryFeedSummaries, queryRiverPage, queryWorkspaceSummaries } from "../db/crud/query";
import { getDetailedLogging, getRefreshInterval, getRefreshOnLaunch, setDetailedLogging, setRefreshInterval, setRefreshOnLaunch, toRefreshInterval } from "../settings";
import { getAppInfo } from "../app-info";
import { sendToRenderer } from "./sendToRenderer";
import { openAndImportOpml } from "../opml/import";
import { exportWorkspaceOpml } from "../opml/export";
import { getFeedpackCatalog } from '../feedpacks/catalog';
import { installFeedpack, previewFeedpack } from '../feedpacks/install';
import type { IpcMainInvokeEvent } from "electron";
import type {
  AddFeedError,
  AppInfo,
  CatalogError,
  CreateCategoryError,
  CreateWorkspaceError,
  DeleteCategoryError,
  DeleteFeedError,
  DeleteWorkspaceError,
  ExportOpmlError,
  FeedCategory,
  FeedFetchError,
  FeedpackCatalog,
  FeedpackError,
  FeedpackInstallTarget,
  FeedpackPreview,
  FeedSummary,
  ImportOpmlError,
  ImportOpmlTarget,
  ImportSummary,
  InstallFeedpackError,
  ItemBody,
  MoveFeedError,
  NewFeedInput,
  ParsedSource,
  RefreshInterval,
  RefreshSummary,
  RiverPage,
  RiverQuery,
  SourceType,
  UpdateCategoryError,
  UpdateFeedError,
  UpdateItemError,
  UpdateWorkspaceError,
  Workspace,
  WorkspaceSummary,
} from "../../shared/contracts";
import type { Result } from "../../shared/result";
import { dbReady, dbStatus } from '../db/database';
import type { StartupHealth } from '../../shared/contracts';
import { setDetailedLogging as applyDetailedLogging } from '../logging/logger';
import { getRetentionDays, setRetentionDays, toRetentionDays } from '../settings';
import { retainedFetchedItems, pruneExpiredItems, retentionCutoff } from '../db/retention';
import { broadcastToRenderers } from './sendToRenderer';
import { backUpDatabase } from '../db/database';
import { dialog } from 'electron';
import type { RetentionDays } from '../../shared/contracts';

export async function handleFeedsValidateFeedUrl(_event: IpcMainInvokeEvent, payload: { query: string; type?: SourceType }): Promise<Result<ParsedSource, FeedFetchError>> {
  const result = await resolveSource(payload.query, payload.type).fetch({ link: payload.query });
  if (!result.success) {
    return result;
  }
  if ('notModified' in result.data) {
    return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: 'The feed did not change since it was last fetched.' } };
  }
  return { success: true, data: result.data.parsed };
}

export function handleFeedsListCategories(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<FeedCategory[]> {
  return queryFeedCategory({ workspace_id: payload.workspaceId });
}

export function handleFeedsList(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<FeedSummary[]> {
  return queryFeedSummaries(payload.workspaceId);
}

export function handleItemsQuery(_event: IpcMainInvokeEvent, payload: RiverQuery): Promise<RiverPage> {
  return queryRiverPage(payload);
}

export async function handleFeedsSubmitAddFeed(event: IpcMainInvokeEvent, payload: NewFeedInput): Promise<Result<FeedSummary, AddFeedError>> {
  const cutoff = retentionCutoff(await getRetentionDays());
  const result = await addFeedToDatabase({ ...payload, items: retainedFetchedItems(payload.items, cutoff) }, cutoff);
  if (!result.success) {
    return result;
  }

  const { items, category, ...metadata } = result.data;
  if (sourceFor(payload.type).fetchesFullArticle) {
    void enrichItems(items, (itemId, image) => {
      void updateFeedItemImage(itemId, image);
      sendToRenderer(event.sender, 'feeds:item-image-fetched', { feedId: metadata.id, itemId, image });
    });
  }

  return {
    success: true,
    data: { ...metadata, category, itemCount: items.length, unreadCount: items.filter((item) => !item.read_at).length },
  };
}

export function handleFeedsRefresh(): Promise<RefreshSummary> {
  return refreshAllFeeds();
}

export async function handleFeedsDeleteFeed(_event: IpcMainInvokeEvent, payload: { feedId: number; workspaceId: number }): Promise<Result<void, DeleteFeedError>> {
  return deleteFeedFromDatabase(payload.feedId, payload.workspaceId);
}

export async function handleFeedsSetShowInWorkspace(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; showInWorkspace: boolean; workspaceId: number }): Promise<Result<void, UpdateFeedError>> {
  return setFeedsShowInWorkspace(payload.feedIds, payload.showInWorkspace, payload.workspaceId);
}

export async function handleFeedsCreateCategory(_event: IpcMainInvokeEvent, payload: { name: string; workspaceId: number }): Promise<Result<FeedCategory, CreateCategoryError>> {
  return createCategory(payload.name, payload.workspaceId);
}

export async function handleFeedsRenameCategory(_event: IpcMainInvokeEvent, payload: { categoryId: number; name: string; workspaceId: number }): Promise<Result<FeedCategory, UpdateCategoryError>> {
  return renameCategory(payload.categoryId, payload.name, payload.workspaceId);
}

export async function handleFeedsDeleteCategory(_event: IpcMainInvokeEvent, payload: { categoryId: number; reassignTo: number; workspaceId: number }): Promise<Result<void, DeleteCategoryError>> {
  return deleteCategory(payload.categoryId, payload.reassignTo, payload.workspaceId);
}

export async function handleFeedsMoveFeedsToCategory(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; categoryId: number; workspaceId: number }): Promise<Result<void, UpdateCategoryError>> {
  return moveFeedsToCategory(payload.feedIds, payload.categoryId, payload.workspaceId);
}

export async function handleFeedsMoveToWorkspace(_event: IpcMainInvokeEvent, payload: { feedId: number; fromWorkspaceId: number; toWorkspaceId: number; categoryName: string }): Promise<Result<void, MoveFeedError>> {
  return moveFeedToWorkspace(payload.feedId, payload.fromWorkspaceId, payload.toWorkspaceId, payload.categoryName);
}

export function handleWorkspacesList(): Promise<WorkspaceSummary[]> {
  return queryWorkspaceSummaries();
}

export async function handleWorkspacesCreate(_event: IpcMainInvokeEvent, payload: { name: string; icon: string; color: string }): Promise<Result<Workspace, CreateWorkspaceError>> {
  return createWorkspace(payload.name, payload.icon, payload.color);
}

export async function handleWorkspacesUpdate(_event: IpcMainInvokeEvent, payload: { workspaceId: number; name?: string; icon?: string; color?: string }): Promise<Result<Workspace, UpdateWorkspaceError>> {
  const { workspaceId, ...patch } = payload;
  return updateWorkspace(workspaceId, {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
  });
}

export async function handleWorkspacesDelete(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<Result<void, DeleteWorkspaceError>> {
  return deleteWorkspace(payload.workspaceId);
}

export async function handleWorkspacesReorder(_event: IpcMainInvokeEvent, payload: { orderedIds: number[] }): Promise<Result<void, UpdateWorkspaceError>> {
  return reorderWorkspaces(payload.orderedIds);
}

export function handleSettingsGetRefreshInterval(): Promise<RefreshInterval> {
  return getRefreshInterval();
}

export async function handleSettingsSetRefreshInterval(_event: IpcMainInvokeEvent, payload: RefreshInterval): Promise<RefreshInterval> {
  const interval = toRefreshInterval(payload);
  await setRefreshInterval(interval);
  rescheduleRefresh(interval);
  return interval;
}

export async function handleItemsSetRead(_event: IpcMainInvokeEvent, payload: { itemIds: number[]; read: boolean }): Promise<Result<void, UpdateItemError>> {
  return setFeedItemsRead(payload.itemIds, payload.read);
}

/**
 * Resolves an item's raw description plus, for sources the registry marks as `fetchesFullArticle`,
 * its extracted full article, fetching and storing it on the first request. A `failed` or `too_short`
 * row on file is left out of the response without a retry, so a page that never works is not refetched
 * on every open.
 */
export async function handleItemsGetContent(_event: IpcMainInvokeEvent, itemId: number): Promise<ItemBody> {
  const [item] = await queryFeedItems({ id: itemId });
  if (!item) {
    return { description: '', article: undefined };
  }

  const [feed] = await queryFeedMetadata({ id: item.feed_id });
  if (!feed || !sourceFor(feed.type).fetchesFullArticle) {
    return { description: item.description, article: undefined };
  }

  const [existing] = await queryArticleContent({ item_id: itemId });
  if (existing) {
    return {
      description: item.description,
      article: existing.status === 'ok' && existing.html && existing.word_count
        ? { html: existing.html, wordCount: existing.word_count }
        : undefined,
    };
  }

  if (!item.link) {
    return { description: item.description, article: undefined };
  }

  const fetched = await fetchText(item.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
  let article;
  if (fetched.success) {
    try {
      article = await extractArticleInUtilityProcess(fetched.data.body, item.link);
    } catch (error) {
      logger.error('operation.failure', { operation: 'extract-article', entityId: itemId }, error);
    }
  }
  const status = deriveArticleContentStatus(article);
  await upsertArticleContent({ item_id: itemId, html: article?.html, text: article?.text, word_count: article?.wordCount, status });

  return {
    description: item.description,
    article: status === 'ok' && article ? { html: article.html, wordCount: article.wordCount } : undefined,
  };
}

export function handleSettingsGetRefreshOnLaunch(): Promise<boolean> {
  return getRefreshOnLaunch();
}

export async function handleSettingsSetRefreshOnLaunch(_event: IpcMainInvokeEvent, payload: boolean): Promise<boolean> {
  await setRefreshOnLaunch(payload);
  return payload;
}

export function handleAppGetInfo(): Promise<AppInfo> {
  return getAppInfo();
}

export function handleSettingsGetRetentionDays(): Promise<RetentionDays> {
  return getRetentionDays();
}

export async function handleSettingsSetRetentionDays(_event: IpcMainInvokeEvent, payload: RetentionDays): Promise<RetentionDays> {
  const days = toRetentionDays(payload);
  const previous = await getRetentionDays();
  await setRetentionDays(days);
  const removed = await pruneExpiredItems(days);
  if (days > previous) {
    const refreshed = await refreshAllFeeds(true);
    broadcastToRenderers('feeds:refreshed', { ...refreshed, removed: (refreshed.removed ?? 0) + removed, applyImmediately: true });
  } else if (removed > 0) {
    broadcastToRenderers('feeds:refreshed', { perFeed: [], removed, applyImmediately: true });
  }
  return days;
}

export async function handleAppBackUpDatabase(): Promise<Result<void, { name: 'CANCELLED' | 'BACKUP_FAILED'; message: string }>> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `monfil-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: 'SQLite database', extensions: ['db'] }],
  });
  if (canceled || !filePath) {
    return { success: false, error: { name: 'CANCELLED', message: 'Backup cancelled.' } };
  }
  try {
    await backUpDatabase(filePath);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'BACKUP_FAILED', message: error instanceof Error ? error.message : String(error) } };
  }
}

export async function handleAppGetStartupHealth(): Promise<StartupHealth> {
  try {
    await dbReady;
  } catch {
    // dbStatus contains the safe failure state returned below.
  }
  if (dbStatus.name === 'OK') {
    return dbStatus;
  }
  return { name: dbStatus.name, incidentId: dbStatus.incidentId };
}

export function handleSettingsGetDetailedLogging(): Promise<boolean> {
  return getDetailedLogging();
}

export async function handleSettingsSetDetailedLogging(_event: IpcMainInvokeEvent, payload: boolean): Promise<boolean> {
  await setDetailedLogging(payload);
  applyDetailedLogging(payload);
  return payload;
}

export async function handleOpmlImport(_event: IpcMainInvokeEvent, payload: { target: ImportOpmlTarget }): Promise<Result<ImportSummary, ImportOpmlError>> {
  return openAndImportOpml(payload.target);
}

export async function handleOpmlExport(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<Result<void, ExportOpmlError>> {
  return exportWorkspaceOpml(payload.workspaceId);
}

export function handleFeedpacksList(): Promise<Result<FeedpackCatalog, CatalogError>> {
  return getFeedpackCatalog();
}

export function handleFeedpacksPreview(_event: IpcMainInvokeEvent, payload: { slug: string }): Promise<Result<FeedpackPreview, FeedpackError>> {
  return previewFeedpack(payload.slug);
}

export function handleFeedpacksInstall(_event: IpcMainInvokeEvent, payload: { slug: string; target: FeedpackInstallTarget }): Promise<Result<ImportSummary, InstallFeedpackError>> {
  return installFeedpack(payload.slug, payload.target);
}
