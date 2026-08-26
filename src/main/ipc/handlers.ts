import { enrichItems } from "../feed/enrichItems";
import { ARTICLE_FETCH_TIMEOUT_MS } from "../constants";
import { deriveArticleContentStatus, extractArticle } from "../feed/extractArticle";
import { resolveSource } from "../feed/sources/registry";
import type { FeedFetchError, ParsedSource } from "../feed/sources/types";
import { refreshAllFeeds } from "../feed/refresh";
import { rescheduleRefresh } from "../feed/scheduler";
import { fetchUrl } from "../lib/fetch";
import { addFeedToDatabase, updateFeedItemImage, upsertArticleContent, type AddFeedError, type NewFeedInput } from "../db/crud/insert";
import { deleteFeedFromDatabase, type DeleteFeedError } from "../db/crud/delete";
import { setFeedsShowInHome, setFeedItemsRead, type UpdateFeedError, type UpdateItemError } from "../db/crud/update";
import { queryArticleContent, queryFeedCategory, queryFeedItems, queryFeeds } from "../db/crud/query";
import { getMaxFeedItems, getRefreshInterval, getRefreshOnLaunch, setMaxFeedItems, setRefreshInterval, setRefreshOnLaunch, toRefreshInterval, type MaxFeedItems, type RefreshInterval } from "../settings";
import { getAppInfo, type AppInfo } from "../app-info";
import { sendToRenderer } from "./sendToRenderer";
import type { IpcMainInvokeEvent } from "electron";
import type { ArticleContentResult, Feed, FeedCategory } from "../../preload/channels";
import type { Result } from "../lib/utils";

export async function handleFeedsValidateFeedUrl(_event: IpcMainInvokeEvent, query: string): Promise<Result<ParsedSource, FeedFetchError>> {
  return resolveSource(query).fetch(query, await getMaxFeedItems());
}

export function handleFeedsListCategories(): Promise<FeedCategory[]> {
  return queryFeedCategory({});
}

export function handleFeedsList(): Promise<Feed[]> {
  return queryFeeds();
}

export async function handleFeedsSubmitAddFeed(event: IpcMainInvokeEvent, payload: NewFeedInput): Promise<Result<Feed, AddFeedError>> {
  const result = await addFeedToDatabase(payload);
  if (result.success) {
    const feed = result.data;
    void enrichItems(
      feed.items,
      (itemId, image) => {
        void updateFeedItemImage(itemId, image);
        sendToRenderer(event.sender, 'feeds:item-image-fetched', { feedId: feed.id, itemId, image });
      },
      (itemId, content) => {
        void upsertArticleContent({ item_id: itemId, ...content });
      },
    );
  }
  return result;
}

export function handleFeedsRefresh(): Promise<Feed[]> {
  return refreshAllFeeds();
}

export async function handleFeedsDeleteFeed(_event: IpcMainInvokeEvent, feedId: number): Promise<Result<Feed[], DeleteFeedError>> {
  const result = await deleteFeedFromDatabase(feedId);
  if (!result.success) {
    return result;
  }
  return { success: true, data: await queryFeeds() };
}

export async function handleFeedsSetShowInHome(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; showInHome: boolean }): Promise<Result<Feed[], UpdateFeedError>> {
  const result = await setFeedsShowInHome(payload.feedIds, payload.showInHome);
  if (!result.success) {
    return result;
  }
  return { success: true, data: await queryFeeds() };
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
 * Resolves an item's full article content, extracting and storing it on the first request.
 * A `failed` or `too_short` row on file is returned as `unavailable` without a retry, so a page
 * that never works is not refetched on every open.
 */
export async function handleItemsGetContent(_event: IpcMainInvokeEvent, itemId: number): Promise<ArticleContentResult> {
  const [existing] = await queryArticleContent({ item_id: itemId });
  if (existing) {
    return existing.status === 'ok' && existing.html && existing.word_count
      ? { status: 'ok', html: existing.html, wordCount: existing.word_count }
      : { status: 'unavailable' };
  }

  const [item] = await queryFeedItems({ id: itemId });
  if (!item?.link) {
    return { status: 'unavailable' };
  }

  const fetched = await fetchUrl(item.link, AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS));
  const article = fetched.success ? extractArticle(fetched.data, item.link) : undefined;
  const status = deriveArticleContentStatus(article);
  await upsertArticleContent({ item_id: itemId, html: article?.html, text: article?.text, word_count: article?.wordCount, status });

  return status === 'ok' && article
    ? { status: 'ok', html: article.html, wordCount: article.wordCount }
    : { status: 'unavailable' };
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
