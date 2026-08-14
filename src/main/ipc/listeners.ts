import { shell, type IpcMainEvent } from "electron";
import type { OneWayRendererToMainChannelPayloads } from "../../preload/channels";

export function listenToLinkOpen(_event: IpcMainEvent, url: OneWayRendererToMainChannelPayloads["link:open"]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  // Feed item links come from untrusted, third-party RSS content, so only http(s) URLs are handed to the OS.
  // Anything else (file:, javascript:, a custom protocol handler) is dropped.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    void shell.openExternal(url);
  }
}
