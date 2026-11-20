// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { querySavedPage, setItemSaved } from '../db/saved';
import { enrichItems } from "../feed/enrichItems";
import { logger, setDetailedLogging as applyDetailedLogging } from '../logging/logger';
import { ARTICLE_FETCH_TIMEOUT_MS } from "../lib/constants";
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
import { createSavedSearch, deleteSavedSearch, dismissSearchHint, listSavedSearches, updateSavedSearch } from '../db/crud/searches';
import {
  getDetailedLogging,
  getRefreshInterval,
  getRefreshOnLaunch,
  getRetentionDays,
  getWorkspaceRailExpanded,
  setDetailedLogging,
  setRefreshInterval,
  setRefreshOnLaunch,
  setRetentionDays,
  setWorkspaceRailExpanded,
  toRefreshInterval,
  toRetentionDays,
} from "../app/settings";
import { getAppInfo } from "../app/app-info";
import { changeLanguage, readLanguageState } from '../app/language';
import { getUpdateState } from "../updates/auto-updater";
import { broadcastToRenderers, sendToRenderer } from "../lib/sendToRenderer";
import { changeUsageAnalyticsConsent, dismissUsageAnalyticsPrompt, getUsageAnalyticsState } from '../analytics/consent';
import { incrementCounter } from '../analytics/counters';
import { previewSummary } from '../analytics/report';
import { openAndImportOpml } from "../opml/import";
import { exportWorkspaceOpml } from "../opml/export";
import { getFeedpackCatalog } from '../feedpacks/catalog';
import { mainI18n } from '../lib/i18n';
import { installFeedpack, previewFeedpack } from '../feedpacks/install';
import type { IpcMainInvokeEvent } from "electron";
import { dialog } from 'electron';
import type { SettingGetArg, SettingKey, SettingSetArg, SettingState, SettingTypes } from '../../shared/channels';
import type {
  AddFeedError,
  AppInfo,
  AppUpdateState,
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
  RefreshSummary,
  RetentionDays,
  RiverPage,
  RiverQuery,
  SavedQuery,
  SavedSearch,
  SavedSearchError,
  SavedSearchList,
  SetSavedItemInput,
  UpdateSavedItemError,
  SourceType,
  UpdateCategoryError,
  UpdateFeedError,
  UpdateItemError,
  UpdateWorkspaceError,
  Workspace,
  WorkspaceSummary,
} from "../../shared/contracts";
import type { DailySummaryProps, UsageAnalyticsState } from '../../shared/contracts';
import type { Result } from "../../shared/result";
import { backUpDatabase, dbReady, dbStatus } from '../db/database';
import type { StartupHealth } from '../../shared/contracts';
import { retainedFetchedItems, pruneExpiredItems, retentionCutoff } from '../db/retention';

export function handleFeedsValidateFeedUrl(_event: IpcMainInvokeEvent, payload: { query: string; type?: SourceType }): Promise<Result<ParsedSource[], FeedFetchError>> {
  return resolveSource(payload.query, payload.type).discover(payload.query);
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

export function handleSavedQuery(_event: IpcMainInvokeEvent, payload: SavedQuery): Promise<RiverPage> {
  return querySavedPage(payload);
}

export function handleItemsSetSaved(_event: IpcMainInvokeEvent, payload: SetSavedItemInput): Promise<Result<void, UpdateSavedItemError>> {
  return setItemSaved(payload);
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

export async function handleFeedsDeleteCategory(_event: IpcMainInvokeEvent, payload: { categoryId: number; reassignTo?: number | undefined; workspaceId: number }): Promise<Result<void, DeleteCategoryError>> {
  return deleteCategory(payload.categoryId, payload.workspaceId, payload.reassignTo);
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

type SettingRoute<K extends SettingKey> = {
  get: () => Promise<SettingTypes[K]['state']>;
  set: (value: SettingTypes[K]['value']) => Promise<SettingTypes[K]['state']>;
};

function plainSetting<T>(get: () => Promise<T>, set: (value: T) => Promise<void>): { get: () => Promise<T>; set: (value: T) => Promise<T> } {
  return {
    get,
    async set(value) {
      await set(value);
      return value;
    },
  };
}

async function setRetention(value: RetentionDays): Promise<RetentionDays> {
  const days = toRetentionDays(value);
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

const settingRoutes: { [K in SettingKey]: SettingRoute<K> } = {
  refreshInterval: {
    get: getRefreshInterval,
    async set(value) {
      const interval = toRefreshInterval(value);
      await setRefreshInterval(interval);
      rescheduleRefresh(interval);
      return interval;
    },
  },
  refreshOnLaunch: plainSetting(getRefreshOnLaunch, setRefreshOnLaunch),
  workspaceRailExpanded: plainSetting(getWorkspaceRailExpanded, setWorkspaceRailExpanded),
  retentionDays: { get: getRetentionDays, set: setRetention },
  detailedLogging: plainSetting(getDetailedLogging, async (value) => {
    await setDetailedLogging(value);
    applyDetailedLogging(value);
  }),
  language: { get: readLanguageState, set: changeLanguage },
  usageAnalytics: { get: getUsageAnalyticsState, set: changeUsageAnalyticsConsent },
};

function setSetting<K extends SettingKey>(key: K, value: SettingTypes[K]['value']): Promise<SettingTypes[K]['state']> {
  return settingRoutes[key].set(value);
}

export function handleSettingsGet(_event: IpcMainInvokeEvent, payload: SettingGetArg): Promise<SettingState> {
  return settingRoutes[payload.key].get();
}

export function handleSettingsSet(_event: IpcMainInvokeEvent, payload: SettingSetArg): Promise<SettingState> {
  return setSetting(payload.key, payload.value);
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
  void incrementCounter('fulltext_extracted');

  return {
    description: item.description,
    article: status === 'ok' && article ? { html: article.html, wordCount: article.wordCount } : undefined,
  };
}

export function handleAppGetInfo(): Promise<AppInfo> {
  return getAppInfo();
}

export function handleAppGetUpdateState(): AppUpdateState {
  return getUpdateState();
}

export async function handleAppBackUpDatabase(): Promise<Result<void, { name: 'CANCELLED' | 'BACKUP_FAILED'; message: string }>> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `monfil-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: mainI18n.t('main:dialog.sqliteFilter'), extensions: ['db'] }],
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

export function handleSettingsDismissUsageAnalyticsPrompt(): Promise<UsageAnalyticsState> {
  return dismissUsageAnalyticsPrompt();
}

export function handleAnalyticsPreview(): Promise<DailySummaryProps> {
  return previewSummary();
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

export function handleSearchesList(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<SavedSearchList> {
  return listSavedSearches(payload.workspaceId);
}

export function handleSearchesCreate(_event: IpcMainInvokeEvent, payload: { workspaceId: number; name: string; query: string }): Promise<Result<SavedSearch, SavedSearchError>> {
  return createSavedSearch(payload.workspaceId, payload.name, payload.query);
}

export function handleSearchesUpdate(_event: IpcMainInvokeEvent, payload: { searchId: number; name?: string; query?: string }): Promise<Result<SavedSearch, SavedSearchError>> {
  return updateSavedSearch(payload.searchId, {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.query !== undefined ? { query: payload.query } : {}),
  });
}

export function handleSearchesDelete(_event: IpcMainInvokeEvent, payload: { searchId: number }): Promise<Result<void, SavedSearchError>> {
  return deleteSavedSearch(payload.searchId);
}

export function handleSearchesDismissHint(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<Result<void, UpdateWorkspaceError>> {
  return dismissSearchHint(payload.workspaceId);
}
