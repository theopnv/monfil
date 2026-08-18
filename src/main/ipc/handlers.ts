import { enrichItemImages } from "../feed/enrichItemImages";
import { refreshAllFeeds } from "../feed/refresh";
import { rescheduleRefresh } from "../feed/scheduler";
import { addFeedToDatabase, updateFeedItemImage, type AddFeedError, type NewFeedInput } from "../db/insert";
import { deleteFeedFromDatabase, type DeleteFeedError } from "../db/delete";
import { setFeedsShowInHome, setFeedItemsRead, type UpdateFeedError, type UpdateItemError } from "../db/update";
import { queryFeeds } from "../db/query";
import { setRefreshInterval, setRefreshOnLaunch, toRefreshInterval, type RefreshInterval } from "../settings";
import { getAppInfo, type AppInfo } from "../app-info";
import { dbReady } from "../database";
import { sendToRenderer } from "./sendToRenderer";
import type { IpcMainInvokeEvent } from "electron";
import type { Feed } from "../../preload/channels";
import type { Result } from "../../utils";

export async function handleFeedsSubmitAddFeed(event: IpcMainInvokeEvent, payload: NewFeedInput): Promise<Result<Feed, AddFeedError>> {
  const result = await addFeedToDatabase(payload);
  if (result.success) {
    const feed = result.data;
    void enrichItemImages(feed.items, (itemId, image) => {
      void updateFeedItemImage(itemId, image);
      sendToRenderer(event.sender, 'feeds:item-image-fetched', { feedId: feed.id, itemId, image });
    });
  }
  return result;
}

export function handleFeedsRefresh(): Promise<Feed[]> {
  return refreshAllFeeds();
}

export async function handleFeedsDeleteFeed(_event: IpcMainInvokeEvent, feedId: number): Promise<Result<Feed[], DeleteFeedError>> {
  const result = await deleteFeedFromDatabase(feedId);
  if (!result.success) return result;
  return { success: true, data: await queryFeeds() };
}

export async function handleFeedsSetShowInHome(_event: IpcMainInvokeEvent, payload: { feedIds: number[]; showInHome: boolean }): Promise<Result<Feed[], UpdateFeedError>> {
  const result = await setFeedsShowInHome(payload.feedIds, payload.showInHome);
  if (!result.success) return result;
  return { success: true, data: await queryFeeds() };
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

export async function handleSettingsSetRefreshOnLaunch(_event: IpcMainInvokeEvent, payload: boolean): Promise<boolean> {
  await setRefreshOnLaunch(payload);
  return payload;
}

export async function handleAppGetInfo(): Promise<AppInfo> {
  await dbReady;
  return getAppInfo();
}
