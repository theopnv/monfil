// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { TwoWayRendererMainChannelPayloads, TwoWayRendererMainChannels, TwoWayRendererMainChannelsInvokeArgs } from '../../shared/channels';
import type { FeedCategory, FeedpackCatalog, FeedSummary, NewFeedInput, ParsedSource, WorkspaceSummary } from '../../shared/contracts';
import * as handlers from './handlers';
import * as insert from '../db/crud/insert';
import * as update from '../db/crud/update';
import * as remove from '../db/crud/delete';
import * as query from '../db/crud/query';
import * as saved from '../db/saved';
import * as settings from '../settings';
import { resolveSource } from '../feed/sources/registry';
import { refreshAllFeeds } from '../feed/refresh';
import { openAndImportOpml } from '../opml/import';
import { exportWorkspaceOpml } from '../opml/export';
import { getFeedpackCatalog } from '../feedpacks/catalog';
import { installFeedpack, previewFeedpack } from '../feedpacks/install';
import { getAppInfo } from '../app-info';
import { logger } from '../logging/logger';
import { registerIpcHandlers } from './registerIpcHandlers';

vi.mock(import('electron'), () => ({ ipcMain: { handle: vi.fn() } as unknown as typeof ipcMain, dialog: { showSaveDialog: vi.fn() } as unknown as typeof dialog }));
vi.mock(import('./handlers'), { spy: true });
vi.mock(import('../logging/logger'), () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() }, setDetailedLogging: vi.fn() }));
vi.mock(import('../logging/incident'), () => ({ createIncidentId: () => 'test-incident' }));
vi.mock(import('../db/database'), () => ({ dbReady: Promise.resolve(), dbStatus: { name: 'OK' as const }, backUpDatabase: vi.fn() }));
vi.mock(import('../db/crud/insert'), () => ({
  addFeedToDatabase: vi.fn(), createCategory: vi.fn(), createWorkspace: vi.fn(), updateFeedItemImage: vi.fn(), upsertArticleContent: vi.fn(),
}));
vi.mock(import('../db/crud/delete'), () => ({ deleteCategory: vi.fn(), deleteFeedFromDatabase: vi.fn(), deleteWorkspace: vi.fn() }));
vi.mock(import('../db/crud/update'), () => ({
  moveFeedsToCategory: vi.fn(), moveFeedToWorkspace: vi.fn(), renameCategory: vi.fn(), reorderWorkspaces: vi.fn(),
  setFeedsShowInWorkspace: vi.fn(), setFeedItemsRead: vi.fn(), updateWorkspace: vi.fn(),
}));
vi.mock(import('../db/crud/query'), () => ({
  queryArticleContent: vi.fn(), queryFeedCategory: vi.fn(), queryFeedItems: vi.fn(), queryFeedMetadata: vi.fn(),
  queryFeedSummaries: vi.fn(), queryRiverPage: vi.fn(), queryWorkspaceSummaries: vi.fn(),
}));
vi.mock(import('../db/saved'), () => ({ querySavedPage: vi.fn(), setItemSaved: vi.fn() }));
vi.mock(import('../db/retention'), () => ({ retentionCutoff: () => 0, retainedFetchedItems: <T>(items: T[]) => items, pruneExpiredItems: async () => 0 }));
vi.mock(import('../feed/sources/registry'), () => ({ resolveSource: vi.fn(), sourceFor: vi.fn(() => ({ type: 'rss' as const, fetchesFullArticle: false, fetch: vi.fn(), parse: vi.fn() })) }));
vi.mock(import('../feed/refresh'), () => ({ refreshAllFeeds: vi.fn() }));
vi.mock(import('../feed/scheduler'), () => ({ rescheduleRefresh: vi.fn() }));
vi.mock(import('../feed/enrichItems'), () => ({ enrichItems: vi.fn() }));
vi.mock(import('../feed/extractArticle'), () => ({ deriveArticleContentStatus: vi.fn() }));
vi.mock(import('../feed/extractArticleUtility'), () => ({ extractArticleInUtilityProcess: vi.fn() }));
vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('./sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));
vi.mock(import('../settings'), () => ({
  getDetailedLogging: vi.fn(), getRefreshInterval: vi.fn(), getRefreshOnLaunch: vi.fn(), getRetentionDays: vi.fn(),
  setDetailedLogging: vi.fn(), setRefreshInterval: vi.fn(), setRefreshOnLaunch: vi.fn(), setRetentionDays: vi.fn(),
  toRefreshInterval: () => 30, toRetentionDays: () => 30,
}));
vi.mock(import('../opml/import'), () => ({ openAndImportOpml: vi.fn() }));
vi.mock(import('../opml/export'), () => ({ exportWorkspaceOpml: vi.fn() }));
vi.mock(import('../feedpacks/catalog'), () => ({ getFeedpackCatalog: vi.fn() }));
vi.mock(import('../feedpacks/install'), () => ({ installFeedpack: vi.fn(), previewFeedpack: vi.fn() }));
vi.mock(import('../app-info'), () => ({ getAppInfo: vi.fn() }));

const category: FeedCategory = { id: 3, name: 'Tech', workspace_id: 1 };
const feed: FeedSummary = {
  id: 2, link: 'https://example.com/feed', title: 'Feed', type: 'rss', icon: undefined,
  last_fetched_at: undefined, last_error: null, category, workspaceId: 1, showInWorkspace: 1, itemCount: 0, unreadCount: 0,
};
const workspace: WorkspaceSummary = {
  id: 1, name: 'Home', icon: 'Home01', color: 'blue', position: 0,
  source_slug: undefined, source_version: undefined, installed_at: undefined, hasUnread: false,
};
const source: ParsedSource = {
  link: feed.link, title: feed.title, type: 'rss', icon: undefined, description: '',
  items: [{ title: 'Item', guid: 'item', link: undefined, pubDate: 'invalid-date', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
};
const newFeed: NewFeedInput = {
  link: source.link, title: source.title, type: source.type, items: source.items,
  categoryName: category.name, workspaceId: 1, showInWorkspace: true,
};
const done = { success: true, data: undefined } as const;
const imported = { success: true as const, data: { workspaceId: 1, imported: 1, skipped: [], failed: [] } };
const catalog: FeedpackCatalog = { version: 1, packs: [] };
const preview = { pack: { slug: 'tech', title: 'Tech', description: '', tags: [], curator: '', sourceCount: 1, updatedAt: '', opml: 'tech.opml' }, sources: { title: 'Tech', categories: [] } };

type Fixture<C extends TwoWayRendererMainChannels> = {
  arg: TwoWayRendererMainChannelsInvokeArgs[C];
  response: TwoWayRendererMainChannelPayloads[C];
  handler: (...args: never[]) => unknown;
};

const fixtures: { [C in TwoWayRendererMainChannels]: Fixture<C> } = {
  'feeds:validate-feed-url': { arg: { query: feed.link, type: 'rss' }, response: { success: true, data: source }, handler: handlers.handleFeedsValidateFeedUrl },
  'feeds:list-categories': { arg: { workspaceId: 1 }, response: [category], handler: handlers.handleFeedsListCategories },
  'feeds:list': { arg: { workspaceId: 1 }, response: [feed], handler: handlers.handleFeedsList },
  'items:query': { arg: { workspaceId: 1, limit: 50, feedIds: [2], ids: [4], cursor: { publishedAt: 0, id: 4 }, unreadOnly: false, search: '' }, response: { rows: [], nextCursor: { publishedAt: 0, id: 4 } }, handler: handlers.handleItemsQuery },
  'saved:query': { arg: { workspaceId: 1, limit: 50, cursor: { savedAt: 1, publishedAt: 0, id: 4 } }, response: { rows: [] }, handler: handlers.handleSavedQuery },
  'items:set-saved': { arg: { workspaceId: 1, itemId: 4, saved: true }, response: done, handler: handlers.handleItemsSetSaved },
  'feeds:refresh': { arg: undefined, response: { perFeed: [{ feedId: 2, inserted: 0, updated: 1 }], removed: 0 }, handler: handlers.handleFeedsRefresh },
  'feeds:submit-add-feed': { arg: newFeed, response: { success: true, data: feed }, handler: handlers.handleFeedsSubmitAddFeed },
  'feeds:delete-feed': { arg: { feedId: 2, workspaceId: 1 }, response: done, handler: handlers.handleFeedsDeleteFeed },
  'feeds:set-show-in-workspace': { arg: { feedIds: [2], showInWorkspace: false, workspaceId: 1 }, response: done, handler: handlers.handleFeedsSetShowInWorkspace },
  'feeds:create-category': { arg: { name: 'Tech', workspaceId: 1 }, response: { success: true, data: category }, handler: handlers.handleFeedsCreateCategory },
  'feeds:rename-category': { arg: { categoryId: 3, name: 'Tech', workspaceId: 1 }, response: { success: true, data: category }, handler: handlers.handleFeedsRenameCategory },
  'feeds:delete-category': { arg: { categoryId: 3, reassignTo: 5, workspaceId: 1 }, response: done, handler: handlers.handleFeedsDeleteCategory },
  'feeds:move-feeds-to-category': { arg: { feedIds: [2], categoryId: 3, workspaceId: 1 }, response: done, handler: handlers.handleFeedsMoveFeedsToCategory },
  'feeds:move-to-workspace': { arg: { feedId: 2, fromWorkspaceId: 1, toWorkspaceId: 6, categoryName: 'Tech' }, response: done, handler: handlers.handleFeedsMoveToWorkspace },
  'workspaces:list': { arg: undefined, response: [workspace], handler: handlers.handleWorkspacesList },
  'workspaces:create': { arg: { name: 'Home', icon: 'Home01', color: 'blue' }, response: { success: true, data: workspace }, handler: handlers.handleWorkspacesCreate },
  'workspaces:update': { arg: { workspaceId: 1, name: 'Home' }, response: { success: true, data: workspace }, handler: handlers.handleWorkspacesUpdate },
  'workspaces:delete': { arg: { workspaceId: 6 }, response: done, handler: handlers.handleWorkspacesDelete },
  'workspaces:reorder': { arg: { orderedIds: [1, 6] }, response: done, handler: handlers.handleWorkspacesReorder },
  'settings:get-refresh-interval': { arg: undefined, response: 30, handler: handlers.handleSettingsGetRefreshInterval },
  'settings:set-refresh-interval': { arg: 30, response: 30, handler: handlers.handleSettingsSetRefreshInterval },
  'items:set-read': { arg: { itemIds: [4], read: true }, response: done, handler: handlers.handleItemsSetRead },
  'items:get-content': { arg: 4, response: { description: '', article: undefined }, handler: handlers.handleItemsGetContent },
  'settings:get-refresh-on-launch': { arg: undefined, response: false, handler: handlers.handleSettingsGetRefreshOnLaunch },
  'settings:set-refresh-on-launch': { arg: false, response: false, handler: handlers.handleSettingsSetRefreshOnLaunch },
  'settings:get-retention-days': { arg: undefined, response: 30, handler: handlers.handleSettingsGetRetentionDays },
  'settings:set-retention-days': { arg: 30, response: 30, handler: handlers.handleSettingsSetRetentionDays },
  'app:back-up-database': { arg: undefined, response: { success: false, error: { name: 'CANCELLED', message: 'Backup cancelled.' } }, handler: handlers.handleAppBackUpDatabase },
  'app:get-info': { arg: undefined, response: { version: '1', feedCount: 1, itemCount: 0, databaseSizeBytes: 0 }, handler: handlers.handleAppGetInfo },
  'app:get-startup-health': { arg: undefined, response: { name: 'OK' }, handler: handlers.handleAppGetStartupHealth },
  'settings:get-detailed-logging': { arg: undefined, response: false, handler: handlers.handleSettingsGetDetailedLogging },
  'settings:set-detailed-logging': { arg: false, response: false, handler: handlers.handleSettingsSetDetailedLogging },
  'opml:import': { arg: { target: { kind: 'new-workspace', name: 'Tech', icon: 'Home01', color: 'blue', sourceSlug: 'tech', sourceVersion: '1' } }, response: imported, handler: handlers.handleOpmlImport },
  'opml:export': { arg: { workspaceId: 1 }, response: done, handler: handlers.handleOpmlExport },
  'feedpacks:list': { arg: undefined, response: { success: true, data: catalog }, handler: handlers.handleFeedpacksList },
  'feedpacks:preview': { arg: { slug: 'tech' }, response: { success: true, data: preview }, handler: handlers.handleFeedpacksPreview },
  'feedpacks:install': { arg: { slug: 'tech', target: { kind: 'merge-workspace', workspaceId: 1 } }, response: imported, handler: handlers.handleFeedpacksInstall },
};

const channels = Object.keys(fixtures) as TwoWayRendererMainChannels[];
const event = {} as IpcMainInvokeEvent;
const invalidPayload = { success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } };

function registered(channel: TwoWayRendererMainChannels) {
  const registration = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel);
  if (!registration) {
    throw new Error(`Missing handler for ${channel}`);
  }
  return registration[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(insert.addFeedToDatabase).mockResolvedValue({ success: true, data: { ...feed, items: [] } });
  vi.mocked(insert.createCategory).mockResolvedValue({ success: true, data: category });
  vi.mocked(insert.createWorkspace).mockResolvedValue({ success: true, data: workspace });
  vi.mocked(update.renameCategory).mockResolvedValue({ success: true, data: category });
  vi.mocked(update.updateWorkspace).mockResolvedValue({ success: true, data: workspace });
  for (const operation of [remove.deleteCategory, remove.deleteFeedFromDatabase, remove.deleteWorkspace, update.moveFeedsToCategory, update.moveFeedToWorkspace, update.reorderWorkspaces, update.setFeedsShowInWorkspace, update.setFeedItemsRead]) {
    vi.mocked(operation).mockResolvedValue(done);
  }
  vi.mocked(query.queryFeedCategory).mockResolvedValue([category]);
  vi.mocked(query.queryFeedSummaries).mockResolvedValue([feed]);
  vi.mocked(query.queryWorkspaceSummaries).mockResolvedValue([workspace]);
  vi.mocked(saved.setItemSaved).mockResolvedValue(done);
  vi.mocked(saved.querySavedPage).mockResolvedValue({ rows: [] });
  vi.mocked(query.queryRiverPage).mockResolvedValue(fixtures['items:query'].response);
  vi.mocked(query.queryFeedItems).mockResolvedValue([]);
  vi.mocked(settings.getRefreshInterval).mockResolvedValue(30);
  vi.mocked(settings.getRetentionDays).mockResolvedValue(30);
  vi.mocked(settings.getRefreshOnLaunch).mockResolvedValue(false);
  vi.mocked(settings.getDetailedLogging).mockResolvedValue(false);
  vi.mocked(resolveSource).mockReturnValue({ fetch: vi.fn().mockResolvedValue({ success: true, data: { parsed: source } }) } as unknown as ReturnType<typeof resolveSource>);
  vi.mocked(refreshAllFeeds).mockResolvedValue(fixtures['feeds:refresh'].response);
  vi.mocked(openAndImportOpml).mockResolvedValue(imported);
  vi.mocked(exportWorkspaceOpml).mockResolvedValue(done);
  vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: catalog });
  vi.mocked(previewFeedpack).mockResolvedValue({ success: true, data: preview });
  vi.mocked(installFeedpack).mockResolvedValue(imported);
  vi.mocked(getAppInfo).mockResolvedValue(fixtures['app:get-info'].response);
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
  registerIpcHandlers();
});

describe('invoke channel contract', () => {
  test('registers every declared channel once', () => {
    // Act
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map(([channel]) => channel);

    // Assert
    expect(registeredChannels.toSorted()).toEqual(channels.toSorted());
  });

  test.each(channels)('%s dispatches a cloned request and returns a cloneable response', async (channel) => {
    // Arrange
    const fixture = fixtures[channel];
    const arg = structuredClone(fixture.arg);

    // Act
    const response: unknown = await registered(channel)(event, arg);

    // Assert
    expect(fixture.handler).toHaveBeenCalledExactlyOnceWith(event, arg);
    expect(response).toEqual(fixture.response);
    expect(structuredClone(response)).toEqual(response);
    expect(arg).toEqual(fixture.arg);
  });

  test.each(channels)('%s rejects an invalid payload before dispatch', async (channel) => {
    // Act
    const response: unknown = await registered(channel)(event, null);

    // Assert
    expect(response).toEqual(invalidPayload);
    expect(fixtures[channel].handler).not.toHaveBeenCalled();
    expect(structuredClone(response)).toEqual(response);
  });

  test.each([NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'])('rejects workspace ID %s before a query', async (workspaceId) => {
    // Act
    const response: unknown = await registered('feeds:list')(event, { workspaceId });

    // Assert
    expect(response).toEqual(invalidPayload);
    expect(query.queryFeedSummaries).not.toHaveBeenCalled();
  });

  test('rejects malformed nested feed items before a database write', async () => {
    // Arrange
    const arg = { ...newFeed, items: [{ ...source.items[0], guid: 1 }] };

    // Act
    const response: unknown = await registered('feeds:submit-add-feed')(event, arg);

    // Assert
    expect(response).toEqual(invalidPayload);
    expect(insert.addFeedToDatabase).not.toHaveBeenCalled();
  });

  test('keeps domain failures as results', async () => {
    // Arrange
    const failure = { success: false, error: { name: 'DUPLICATE_NAME', message: 'Folder exists.' } } as const;
    vi.mocked(insert.createCategory).mockResolvedValueOnce(failure);

    // Act
    const response: unknown = await registered('feeds:create-category')(event, fixtures['feeds:create-category'].arg);

    // Assert
    expect(structuredClone(response)).toEqual(failure);
  });

  test('returns an incident ID when a handler throws', async () => {
    // Arrange
    const error = new Error('internal detail');
    vi.mocked(query.queryFeedSummaries).mockRejectedValueOnce(error);

    // Act
    const response: unknown = await registered('feeds:list')(event, { workspaceId: 1 });

    // Assert
    expect(response).toEqual({ success: false, error: { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed.', incidentId: 'test-incident' } });
    expect(structuredClone(response)).toEqual(response);
    expect(logger.error).toHaveBeenCalledWith('ipc.failure', { channel: 'feeds:list', incidentId: 'test-incident' }, error);
  });
});
