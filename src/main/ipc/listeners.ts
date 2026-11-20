// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app, BrowserWindow, Menu, shell, type IpcMainEvent, type MenuItemConstructorOptions } from "electron";
import type { MenuAction, MenuKind, OneWayRendererToMainChannelPayloads } from "../../shared/channels";
import { HOME_WORKSPACE_ID } from "../../shared/contracts";
import { dbFilePath, dbStatus } from "../db/database";
import { broadcastToRenderers, sendToRenderer } from "../lib/sendToRenderer";
import { openExternalLink } from "../app/window-security";
import { logFilePath } from '../app/main-state';
import { logger } from '../logging/logger';
import { titleBarOverlayForTheme } from '../app/window-chrome';
import { incrementCounter } from '../analytics/counters';
import { setPreferencesSnapshot } from '../analytics/preferences';
import { isLogLevel, isMenuTarget, isRendererUsageRecord, isRevealTarget, isUsagePreferences } from '../../shared/ipc-payloads';
import { installUpdate } from '../updates/auto-updater';
import { refreshFeeds } from '../feed/refresh';
import { mainI18n } from '../lib/i18n';

export function listenToLinkOpen(_event: IpcMainEvent, url: OneWayRendererToMainChannelPayloads["link:open"]) {
  openExternalLink(url);
}

export function listenToReveal(_event: IpcMainEvent, target: OneWayRendererToMainChannelPayloads['app:reveal']) {
  if (!isRevealTarget(target)) {
    return;
  }
  if (target === 'database') {
    shell.showItemInFolder(dbFilePath);
  } else if (target === 'log') {
    shell.showItemInFolder(logFilePath);
  } else if (dbStatus.name === 'RESET') {
    shell.showItemInFolder(dbStatus.quarantinePath);
  }
}

export function listenToRestart() {
  app.relaunch();
  app.exit(0);
}

export function listenToInstallUpdate() {
  installUpdate();
}

export function listenToSetWindowTheme(event: IpcMainEvent, theme: OneWayRendererToMainChannelPayloads['app:set-window-theme']) {
  if (process.platform === 'darwin' || (theme !== 'light' && theme !== 'dark')) {
    return;
  }
  BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay(titleBarOverlayForTheme(theme));
}

export function listenToRendererLog(_event: IpcMainEvent, payload: OneWayRendererToMainChannelPayloads['log:write']) {
  // A bad level would throw inside the listener and reach the fatal handler as an uncaught exception.
  if (isLogLevel(payload?.level)) {
    logger[payload.level](payload.event, payload.data, payload.error);
  }
}

export function listenToUsageRecord(_event: IpcMainEvent, payload: OneWayRendererToMainChannelPayloads['usage:record']) {
  if (isRendererUsageRecord(payload)) {
    void incrementCounter(payload.counter);
  }
}

export function listenToUsagePreferences(_event: IpcMainEvent, payload: OneWayRendererToMainChannelPayloads['usage:preferences']) {
  if (isUsagePreferences(payload)) {
    setPreferencesSnapshot(payload);
  }
}

type MenuTemplate = (event: IpcMainEvent, id: number) => MenuItemConstructorOptions[];

function sendAction(event: IpcMainEvent, action: MenuAction): () => void {
  return () => sendToRenderer(event.sender, 'menu:action', action);
}

const menuTemplates: { [K in MenuKind]: MenuTemplate } = {
  feed: (event, id) => [
    {
      label: mainI18n.t("main:menu.feed.refreshFeed"),
      click: () => {
        refreshFeeds([id], true)
          .then((summary) => broadcastToRenderers("feeds:refreshed", { ...summary, applyImmediately: true }))
          .catch((error: unknown) => logger.error("feed.refresh", { outcome: "failed", feedId: id }, error));
      },
    },
    { label: mainI18n.t("main:menu.feed.moveFeed"), click: sendAction(event, { kind: 'feed', action: 'move', id }) },
    { label: mainI18n.t("main:menu.feed.deleteFeed"), click: sendAction(event, { kind: 'feed', action: 'delete', id }) },
  ],
  category: (event, id) => [
    { label: mainI18n.t("main:menu.category.rename"), click: sendAction(event, { kind: 'category', action: 'rename', id }) },
    { label: mainI18n.t("main:menu.category.delete"), click: sendAction(event, { kind: 'category', action: 'delete', id }) },
  ],
  workspace: (event, id) => [
    { label: mainI18n.t("main:menu.workspace.edit"), click: sendAction(event, { kind: 'workspace', action: 'edit', id }) },
    { label: mainI18n.t("main:menu.workspace.export"), click: sendAction(event, { kind: 'workspace', action: 'export', id }) },
    // Home is the one workspace every install always has; it cannot be deleted.
    ...(id === HOME_WORKSPACE_ID ? [] : [{ label: mainI18n.t("main:menu.workspace.delete"), click: sendAction(event, { kind: 'workspace', action: 'delete', id }) }]),
  ],
};

export function listenToShowMenu(event: IpcMainEvent, target: OneWayRendererToMainChannelPayloads['menu:show']) {
  if (!isMenuTarget(target)) {
    return;
  }
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    Menu.buildFromTemplate(menuTemplates[target.kind](event, target.id)).popup({ window });
  }
}
