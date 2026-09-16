import { enrichItems } from "../feed/enrichItems";
import { ARTICLE_FETCH_TIMEOUT_MS } from "../constants";
import { deriveArticleContentStatus, extractArticle } from "../feed/extractArticle";
import { resolveSource, sourceFor } from "../feed/sources/registry";
import type { FeedFetchError, ParsedSource } from "../feed/sources/types";
import type { SourceType } from "../db/types";
import { refreshAllFeeds } from "../feed/refresh";
import { rescheduleRefresh } from "../feed/scheduler";
import { fetchUrl } from "../lib/fetch";
import { addFeedToDatabase, createCategory, updateFeedItemImage, upsertArticleContent, type AddFeedError, type CreateCategoryError, type NewFeedInput } from "../db/crud/insert";
import { deleteCategory, deleteFeedFromDatabase, type DeleteCategoryError, type DeleteFeedError } from "../db/crud/delete";
import { moveFeedsToCategory, renameCategory, setFeedsShowInWorkspace, setFeedItemsRead, type UpdateCategoryError, type UpdateFeedError, type UpdateItemError } from "../db/crud/update";
import { queryArticleContent, queryFeedCategory, queryFeedItems, queryFeedMetadata, queryFeedSummaries, queryRiverPage } from "../db/crud/query";
import { getMaxFeedItems, getRefreshInterval, getRefreshOnLaunch, setMaxFeedItems, setRefreshInterval, setRefreshOnLaunch, toRefreshInterval, type MaxFeedItems, type RefreshInterval } from "../settings";
import { getAppInfo, type AppInfo } from "../app-info";
import { sendToRenderer } from "./sendToRenderer";
import type { IpcMainInvokeEvent } from "electron";
import type { FeedCategory, FeedSummary, ItemBody, RefreshSummary, RiverPage, RiverQuery } from "../../preload/channels";
import type { Result } from "../lib/utils";

export async function handleFeedsValidateFeedUrl(_event: IpcMainInvokeEvent, payload: { query: string; type?: SourceType }): Promise<Result<ParsedSource, FeedFetchError>> {
  return resolveSource(payload.query, payload.type).fetch(payload.query, await getMaxFeedItems());
}

export function handleFeedsListCategories(): Promise<FeedCategory[]> {
  return queryFeedCategory({});
}

export function handleFeedsList(): Promise<FeedSummary[]> {
  return queryFeedSummaries();
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

export async function handleFeedsDeleteFeed(_event: IpcMainInvokeEvent, feedId: number): Promise<Result<void, DeleteFeedError>> {
  return deleteFeedFromDatabase(feedId);
}

export async function handleFeedsSetShowInWorkspace(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; showInWorkspace: boolean }): Promise<Result<void, UpdateFeedError>> {
  return setFeedsShowInWorkspace(payload.feedIds, payload.showInWorkspace);
}

export async function handleFeedsCreateCategory(_event: IpcMainInvokeEvent, payload: { name: string }): Promise<Result<FeedCategory, CreateCategoryError>> {
  return createCategory(payload.name);
}

export async function handleFeedsRenameCategory(_event: IpcMainInvokeEvent, payload: { categoryId: number; name: string }): Promise<Result<FeedCategory, UpdateCategoryError>> {
  return renameCategory(payload.categoryId, payload.name);
}

export async function handleFeedsDeleteCategory(_event: IpcMainInvokeEvent, payload: { categoryId: number; reassignTo: number }): Promise<Result<void, DeleteCategoryError>> {
  return deleteCategory(payload.categoryId, payload.reassignTo);
}

export async function handleFeedsMoveFeedsToCategory(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; categoryId: number }): Promise<Result<void, UpdateCategoryError>> {
  return moveFeedsToCategory(payload.feedIds, payload.categoryId);
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
