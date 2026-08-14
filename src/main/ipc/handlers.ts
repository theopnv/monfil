import { enrichItemImages } from "../feed/enrichItemImages";
import { addFeedToDatabase, updateFeedItemImage, type AddFeedError, type NewFeedInput } from "../db/insert";
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
