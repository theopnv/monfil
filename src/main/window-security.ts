import { shell, type Session, type WebContents } from 'electron';

/**
 * Hands a link to the OS browser when it is http(s), and drops anything else.
 * Links come from third-party feed and article content, so a file:, javascript: or custom
 * protocol URL must never reach `shell.openExternal`.
 * @param url the link as found in the content
 */
export function openExternalLink(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    void shell.openExternal(url);
  }
}

/**
 * Tells whether two URLs point at the same document, ignoring the fragment.
 * The renderer routes with the hash, so the app URL only ever changes after `#`.
 * @param currentUrl the URL the window shows now
 * @param targetUrl the URL a navigation asks for
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
 * @param contents the web contents of an app window
 */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event) => {
    if (!isSameDocument(contents.getURL(), event.url)) {
      event.preventDefault();
    }
  });
}

/**
 * Refuses every web permission (notifications, media, geolocation, ...). Electron grants them all
 * when no handler is set, and the renderer needs none.
 * @param session the session the app windows load in
 */
export function denyWebPermissions(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
}
