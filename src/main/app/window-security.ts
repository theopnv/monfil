// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { shell, type Session, type WebContents } from 'electron';
import { parseHttpUrl } from '../../shared/url';

/**
 * Hands a link to the OS browser when it is http(s), and drops anything else.
 * Links come from third-party feed and article content, so a file:, javascript: or custom
 * protocol URL must never reach `shell.openExternal`.
 */
export function openExternalLink(url: string): void {
  if (parseHttpUrl(url)) {
    void shell.openExternal(url);
  }
}

/**
 * Tells whether two URLs point at the same document, ignoring the fragment.
 * The renderer routes with the hash, so the app URL only ever changes after `#`.
 */
export function isSameDocument(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    current.hash = '';
    target.hash = '';
    return current.href === target.href;
  } catch {
    return false;
  }
}

/**
 * Keeps a window on the app's own document. Chromium would otherwise open a middle-clicked
 * or `window.open`ed link in a new BrowserWindow that inherits the preload bridge, and a
 * dropped file or a changed `location` would replace the app with a foreign page.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });
  const keepOnAppDocument = (event: { url: string; preventDefault: () => void }): void => {
    if (!isSameDocument(contents.getURL(), event.url)) {
      event.preventDefault();
    }
  };
  contents.on('will-navigate', keepOnAppDocument);
  contents.on('will-redirect', keepOnAppDocument);
}

/**
 * Refuses every web permission (notifications, media, geolocation, ...). Electron grants them all
 * when no handler is set, and the renderer needs none.
 */
export function denyWebPermissions(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
}

export function configureYouTubeEmbedReferrer(session: Session): void {
  session.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube-nocookie.com/embed/*'] }, (details, callback) => {
    // YouTube rejects file-backed desktop embeds without an app identity in the Referer header.
    const requestHeaders = details.resourceType === 'subFrame'
      ? { ...details.requestHeaders, Referer: 'app://monfil' }
      : details.requestHeaders;
    callback({ requestHeaders });
  });
}
