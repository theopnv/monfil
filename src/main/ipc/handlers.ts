import { enrichItems } from "../feed/enrichItems";
import { ARTICLE_FETCH_TIMEOUT_MS } from "../constants";
import { deriveArticleContentStatus, extractArticle } from "../feed/extractArticle";
import { resolveSource, sourceFor } from "../feed/sources/registry";
import type { FeedFetchError, ParsedSource } from "../feed/sources/types";
import type { SourceType } from "../db/types";
import { refreshAllFeeds } from "../feed/refresh";
import { rescheduleRefresh } from "../feed/scheduler";
import { fetchUrl } from "../lib/fetch";
import { addFeedToDatabase, createCategory, createWorkspace, updateFeedItemImage, upsertArticleContent, type AddFeedError, type CreateCategoryError, type CreateWorkspaceError, type NewFeedInput } from "../db/crud/insert";
import { deleteCategory, deleteFeedFromDatabase, deleteWorkspace, type DeleteCategoryError, type DeleteFeedError, type DeleteWorkspaceError } from "../db/crud/delete";
import { moveFeedsToCategory, moveFeedToWorkspace, renameCategory, reorderWorkspaces, setFeedsShowInWorkspace, setFeedItemsRead, updateWorkspace, type MoveFeedError, type UpdateCategoryError, type UpdateFeedError, type UpdateItemError, type UpdateWorkspaceError } from "../db/crud/update";
import { queryArticleContent, queryFeedCategory, queryFeedItems, queryFeedMetadata, queryFeedSummaries, queryRiverPage, queryWorkspaceSummaries } from "../db/crud/query";
import { getMaxFeedItems, getRefreshInterval, getRefreshOnLaunch, setMaxFeedItems, setRefreshInterval, setRefreshOnLaunch, toRefreshInterval, type MaxFeedItems, type RefreshInterval } from "../settings";
import { getAppInfo, type AppInfo } from "../app-info";
import { sendToRenderer } from "./sendToRenderer";
import { openAndImportOpml, type ImportOpmlError, type ImportOpmlTarget, type ImportSummary } from "../opml/import";
import { exportWorkspaceOpml, type ExportOpmlError } from "../opml/export";
import type { IpcMainInvokeEvent } from "electron";
import type { FeedCategory, FeedSummary, ItemBody, RefreshSummary, RiverPage, RiverQuery, Workspace, WorkspaceSummary } from "../../preload/channels";
import type { Result } from "../lib/utils";

export async function handleFeedsValidateFeedUrl(_event: IpcMainInvokeEvent, payload: { query: string; type?: SourceType }): Promise<Result<ParsedSource, FeedFetchError>> {
  return resolveSource(payload.query, payload.type).fetch(payload.query, await getMaxFeedItems());
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
  const result = await addFeedToDatabase(payload);
  if (!result.success) {
    return result;
  }

  const { items, category, ...metadata } = result.data;
  if (sourceFor(payload.type).fetchesFullArticle) {
    void enrichItems(
      items,
      (itemId, image) => {
        void updateFeedItemImage(itemId, image);
        sendToRenderer(event.sender, 'feeds:item-image-fetched', { feedId: metadata.id, itemId, image });
      },
      (itemId, content) => {
        void upsertArticleContent({ item_id: itemId, ...content });
      },
    );
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

  const fetched = await fetchUrl(item.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS });
  const article = fetched.success ? extractArticle(fetched.data, item.link) : undefined;
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

export function handleSettingsGetMaxFeedItems(): Promise<MaxFeedItems> {
  return getMaxFeedItems();
}

export async function handleSettingsSetMaxFeedItems(_event: IpcMainInvokeEvent, payload: MaxFeedItems): Promise<MaxFeedItems> {
  await setMaxFeedItems(payload);
  return payload;
}

export async function handleOpmlImport(_event: IpcMainInvokeEvent, payload: { target: ImportOpmlTarget }): Promise<Result<ImportSummary, ImportOpmlError>> {
  return openAndImportOpml(payload.target);
}

export async function handleOpmlExport(_event: IpcMainInvokeEvent, payload: { workspaceId: number }): Promise<Result<void, ExportOpmlError>> {
  return exportWorkspaceOpml(payload.workspaceId);
}
