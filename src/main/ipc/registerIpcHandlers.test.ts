// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ipcSchema, type ArgOf, type InvokeChannel, type ResultOf } from '../../shared/ipc-schema';
import type { FeedCategory, FeedpackCatalog, FeedSummary, NewFeedInput, ParsedSource, SavedSearch, WorkspaceSummary } from '../../shared/contracts';
import * as handlers from './handlers';
import * as insert from '../db/crud/insert';
import * as update from '../db/crud/update';
import * as remove from '../db/crud/delete';
import * as query from '../db/crud/query';
import * as saved from '../db/saved';
import * as searches from '../db/crud/searches';
import * as settings from '../app/settings';
import { resolveSource } from '../feed/sources/registry';
import { refreshAllFeeds } from '../feed/refresh';
import { openAndImportOpml } from '../opml/import';
import { exportWorkspaceOpml } from '../opml/export';
import { getFeedpackCatalog } from '../feedpacks/catalog';
import { installFeedpack, previewFeedpack } from '../feedpacks/install';
import { changeUsageAnalyticsConsent, dismissUsageAnalyticsPrompt, getUsageAnalyticsState } from '../analytics/consent';
import { getUpdateState } from '../updates/auto-updater';
import { previewSummary } from '../analytics/report';
import { getErrorReportState, previewReportLog, submitErrorReport } from '../observability/report';
import { sampleErrorEvent } from '../observability/sample';
import { getAppInfo } from '../app/app-info';
import { changeLanguage, readLanguageState } from '../app/language';
import { logger } from '../logging/logger';
import { incrementCounter } from '../analytics/counters';
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
vi.mock(import('../db/crud/searches'), () => ({ createSavedSearch: vi.fn(), deleteSavedSearch: vi.fn(), dismissSearchHint: vi.fn(), listSavedSearches: vi.fn(), updateSavedSearch: vi.fn() }));
vi.mock(import('../db/saved'), () => ({ querySavedPage: vi.fn(), setItemSaved: vi.fn() }));
vi.mock(import('../db/retention'), () => ({ retentionCutoff: () => 0, retainedFetchedItems: <T>(items: T[]) => items, pruneExpiredItems: async () => 0 }));
vi.mock(import('../feed/sources/registry'), () => ({ resolveSource: vi.fn(), sourceFor: vi.fn(() => ({ type: 'rss' as const, fetchesFullArticle: false, matches: vi.fn(), discover: vi.fn(), fetch: vi.fn(), parse: vi.fn() })) }));
vi.mock(import('../feed/refresh'), () => ({ refreshAllFeeds: vi.fn() }));
vi.mock(import('../feed/scheduler'), () => ({ rescheduleRefresh: vi.fn() }));
vi.mock(import('../feed/enrichItems'), () => ({ enrichItems: vi.fn() }));
vi.mock(import('../feed/extractArticle'), () => ({ deriveArticleContentStatus: vi.fn() }));
vi.mock(import('../feed/extractArticleUtility'), () => ({ extractArticleInUtilityProcess: vi.fn() }));
vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('../lib/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));
vi.mock(import('../app/settings'), () => ({
  getDetailedLogging: vi.fn(), getRefreshInterval: vi.fn(), getRefreshOnLaunch: vi.fn(), getRetentionDays: vi.fn(), getWorkspaceRailExpanded: vi.fn(),
  setDetailedLogging: vi.fn(), setRefreshInterval: vi.fn(), setRefreshOnLaunch: vi.fn(), setRetentionDays: vi.fn(), setWorkspaceRailExpanded: vi.fn(),
  toRefreshInterval: (value: unknown) => value as never, toRetentionDays: (value: unknown) => value as never,
}));
vi.mock(import('../opml/import'), () => ({ openAndImportOpml: vi.fn() }));
vi.mock(import('../opml/export'), () => ({ exportWorkspaceOpml: vi.fn() }));
vi.mock(import('../feedpacks/catalog'), () => ({ getFeedpackCatalog: vi.fn() }));
vi.mock(import('../feedpacks/install'), () => ({ installFeedpack: vi.fn(), previewFeedpack: vi.fn() }));
vi.mock(import('../app/app-info'), () => ({ getAppInfo: vi.fn() }));
vi.mock(import('../app/language'), () => ({ changeLanguage: vi.fn(), readLanguageState: vi.fn() }));
vi.mock(import('../analytics/counters'), () => ({ incrementCounter: vi.fn() }));
vi.mock(import('../analytics/consent'), () => ({ changeUsageAnalyticsConsent: vi.fn(), dismissUsageAnalyticsPrompt: vi.fn(), getUsageAnalyticsState: vi.fn() }));
vi.mock(import('../analytics/report'), () => ({ previewSummary: vi.fn() }));
vi.mock(import('../observability/report'), () => ({ getErrorReportState: vi.fn(), previewReportLog: vi.fn(), submitErrorReport: vi.fn() }));
vi.mock(import('../observability/sample'), () => ({ sampleErrorEvent: vi.fn() }));
vi.mock(import('../updates/auto-updater'), () => ({ getUpdateState: vi.fn() }));

const category: FeedCategory = { id: 3, name: 'Tech', workspace_id: 1 };
const feed: FeedSummary = {
  id: 2, link: 'https://example.com/feed', title: 'Feed', type: 'rss', icon: undefined,
  last_fetched_at: undefined, last_error: null, category, workspaceId: 1, showInWorkspace: 1, itemCount: 0, unreadCount: 0, otherWorkspaceCount: 0,
};
const workspace: WorkspaceSummary = {
  id: 1, name: 'Home', icon: 'Home01', color: 'blue', position: 0,
  source_slug: undefined, source_version: undefined, installed_at: undefined, hasUnread: false,
};
const savedSearch: SavedSearch = { id: 4, workspace_id: 1, name: 'Engineers', query: 'title:engineer', position: 0, created_at: 1 };
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
const usageState = { consent: 'granted' as const, shouldPrompt: false, available: true };
const summary = { day: '2026-10-23', articles_opened: 1 };
const reportSample = { release: 'monfil@1.0.0' };
const reportLog = { text: 'line\n', truncated: false };
const reportInput = { incidentId: 'abcd1234', comment: 'It broke.', attachLog: true };
const languageState = { setting: 'system' as const, language: 'en' as const, systemLanguage: 'en' as const };
const preview = { pack: { slug: 'tech', title: 'Tech', description: '', tags: [], curator: '', sourceCount: 1, updatedAt: '', opml: 'tech.opml' }, sources: { title: 'Tech', categories: [] } };

type Fixture<C extends InvokeChannel> = {
  arg: ArgOf<C>;
  response: ResultOf<C>;
  /** The function the route hands the request to, and what it gets. */
  delegate: () => unknown;
  calledWith: unknown[];
};

const discover = vi.fn();
const event = {} as IpcMainInvokeEvent;

const fixtures: { [C in InvokeChannel]: Fixture<C> } = {
  'feeds:discover': { arg: { query: feed.link, type: 'rss' }, response: { success: true, data: [source] }, delegate: () => discover, calledWith: [feed.link] },
  'feeds:list-categories': { arg: { workspaceId: 1 }, response: [category], delegate: () => query.queryFeedCategory, calledWith: [{ workspace_id: 1 }] },
  'feeds:list': { arg: { workspaceId: 1 }, response: [feed], delegate: () => query.queryFeedSummaries, calledWith: [1] },
  'items:query': { arg: { workspaceId: 1, limit: 50, feedIds: [2], ids: [4], cursor: { publishedAt: 0, id: 4 }, unreadOnly: false, search: '' }, response: { rows: [], nextCursor: { publishedAt: 0, id: 4 } }, delegate: () => query.queryRiverPage, calledWith: [{ workspaceId: 1, limit: 50, feedIds: [2], ids: [4], cursor: { publishedAt: 0, id: 4 }, unreadOnly: false, search: '' }] },
  'saved:query': { arg: { workspaceId: 1, limit: 50, cursor: { savedAt: 1, publishedAt: 0, id: 4 } }, response: { rows: [] }, delegate: () => saved.querySavedPage, calledWith: [{ workspaceId: 1, limit: 50, cursor: { savedAt: 1, publishedAt: 0, id: 4 } }] },
  'items:set-saved': { arg: { workspaceId: 1, itemId: 4, saved: true }, response: done, delegate: () => saved.setItemSaved, calledWith: [{ workspaceId: 1, itemId: 4, saved: true }] },
  'feeds:refresh': { arg: undefined, response: { perFeed: [{ feedId: 2, inserted: 0, updated: 1 }], removed: 0 }, delegate: () => refreshAllFeeds, calledWith: [] },
  'feeds:submit-add-feed': { arg: newFeed, response: { success: true, data: feed }, delegate: () => handlers.handleFeedsSubmitAddFeed, calledWith: [newFeed, event] },
  'feeds:delete-feed': { arg: { feedId: 2, workspaceId: 1 }, response: done, delegate: () => remove.deleteFeedFromDatabase, calledWith: [2, 1] },
  'feeds:set-show-in-workspace': { arg: { feedIds: [2], showInWorkspace: false, workspaceId: 1 }, response: done, delegate: () => update.setFeedsShowInWorkspace, calledWith: [[2], false, 1] },
  'feeds:create-category': { arg: { name: 'Tech', workspaceId: 1 }, response: { success: true, data: category }, delegate: () => insert.createCategory, calledWith: ['Tech', 1] },
  'feeds:rename-category': { arg: { categoryId: 3, name: 'Tech', workspaceId: 1 }, response: { success: true, data: category }, delegate: () => update.renameCategory, calledWith: [3, 'Tech', 1] },
  'feeds:delete-category': { arg: { categoryId: 3, reassignTo: 5, workspaceId: 1 }, response: done, delegate: () => remove.deleteCategory, calledWith: [3, 1, 5] },
  'feeds:move-feeds-to-category': { arg: { feedIds: [2], categoryId: 3, workspaceId: 1 }, response: done, delegate: () => update.moveFeedsToCategory, calledWith: [[2], 3, 1] },
  'feeds:move-to-workspace': { arg: { feedId: 2, fromWorkspaceId: 1, toWorkspaceId: 6, categoryName: 'Tech' }, response: done, delegate: () => update.moveFeedToWorkspace, calledWith: [2, 1, 6, 'Tech'] },
  'workspaces:list': { arg: undefined, response: [workspace], delegate: () => query.queryWorkspaceSummaries, calledWith: [] },
  'workspaces:create': { arg: { name: 'Home', icon: 'Home01', color: 'blue' }, response: { success: true, data: workspace }, delegate: () => insert.createWorkspace, calledWith: ['Home', 'Home01', 'blue'] },
  'workspaces:update': { arg: { workspaceId: 1, name: 'Home' }, response: { success: true, data: workspace }, delegate: () => update.updateWorkspace, calledWith: [1, { name: 'Home' }] },
  'workspaces:delete': { arg: { workspaceId: 6 }, response: done, delegate: () => remove.deleteWorkspace, calledWith: [6] },
  'workspaces:reorder': { arg: { orderedIds: [1, 6] }, response: done, delegate: () => update.reorderWorkspaces, calledWith: [[1, 6]] },
  'items:set-read': { arg: { itemIds: [4], read: true }, response: done, delegate: () => update.setFeedItemsRead, calledWith: [[4], true] },
  'items:get-content': { arg: 4, response: { description: '', article: undefined }, delegate: () => handlers.handleItemsGetContent, calledWith: [4] },
  'app:back-up-database': { arg: undefined, response: { success: false, error: { name: 'CANCELLED', message: 'Backup cancelled.' } }, delegate: () => handlers.handleAppBackUpDatabase, calledWith: [] },
  'app:get-info': { arg: undefined, response: { version: '1', feedCount: 1, itemCount: 0, databaseSizeBytes: 0 }, delegate: () => getAppInfo, calledWith: [] },
  'app:get-startup-health': { arg: undefined, response: { name: 'OK' }, delegate: () => handlers.handleAppGetStartupHealth, calledWith: [] },
  'app:get-update-state': { arg: undefined, response: { name: 'NONE' }, delegate: () => getUpdateState, calledWith: [] },
  'settings:get': { arg: { key: 'language' }, response: languageState, delegate: () => handlers.handleSettingsGet, calledWith: [{ key: 'language' }] },
  'settings:set': { arg: { key: 'language', value: 'fr' }, response: { setting: 'fr', language: 'fr', systemLanguage: 'en' }, delegate: () => handlers.handleSettingsSet, calledWith: [{ key: 'language', value: 'fr' }] },
  'settings:dismiss-usage-analytics-prompt': { arg: undefined, response: usageState, delegate: () => dismissUsageAnalyticsPrompt, calledWith: [] },
  'analytics:preview': { arg: undefined, response: summary, delegate: () => previewSummary, calledWith: [] },
  'report:preview-sample': { arg: undefined, response: reportSample, delegate: () => sampleErrorEvent, calledWith: [] },
  'report:get-state': { arg: undefined, response: { enabled: true }, delegate: () => getErrorReportState, calledWith: [] },
  'report:preview-log': { arg: undefined, response: reportLog, delegate: () => previewReportLog, calledWith: [] },
  'report:submit': { arg: reportInput, response: done, delegate: () => submitErrorReport, calledWith: [reportInput] },
  'opml:import': { arg: { target: { kind: 'new-workspace', name: 'Tech', icon: 'Home01', color: 'blue', sourceSlug: 'tech', sourceVersion: '1' } }, response: imported, delegate: () => openAndImportOpml, calledWith: [{ kind: 'new-workspace', name: 'Tech', icon: 'Home01', color: 'blue', sourceSlug: 'tech', sourceVersion: '1' }] },
  'opml:export': { arg: { workspaceId: 1 }, response: done, delegate: () => exportWorkspaceOpml, calledWith: [1] },
  'feedpacks:list': { arg: undefined, response: { success: true, data: catalog }, delegate: () => getFeedpackCatalog, calledWith: [] },
  'feedpacks:preview': { arg: { slug: 'tech' }, response: { success: true, data: preview }, delegate: () => previewFeedpack, calledWith: ['tech'] },
  'feedpacks:install': { arg: { slug: 'tech', target: { kind: 'merge-workspace', workspaceId: 1 } }, response: imported, delegate: () => installFeedpack, calledWith: ['tech', { kind: 'merge-workspace', workspaceId: 1 }] },
  'searches:list': { arg: { workspaceId: 1 }, response: { searches: [], hintExample: undefined }, delegate: () => searches.listSavedSearches, calledWith: [1] },
  'searches:create': { arg: { workspaceId: 1, name: 'Engineers', query: 'title:engineer' }, response: { success: true, data: savedSearch }, delegate: () => searches.createSavedSearch, calledWith: [1, 'Engineers', 'title:engineer'] },
  'searches:update': { arg: { searchId: 4, name: 'Engineers' }, response: { success: true, data: savedSearch }, delegate: () => searches.updateSavedSearch, calledWith: [4, { name: 'Engineers' }] },
  'searches:delete': { arg: { searchId: 4 }, response: done, delegate: () => searches.deleteSavedSearch, calledWith: [4] },
  'searches:dismiss-hint': { arg: { workspaceId: 1 }, response: done, delegate: () => searches.dismissSearchHint, calledWith: [1] },
};

const channels = Object.keys(ipcSchema) as InvokeChannel[];
const invalidPayload = { success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } };

function registered(channel: InvokeChannel) {
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
  vi.mocked(searches.listSavedSearches).mockResolvedValue({ searches: [], hintExample: undefined });
  vi.mocked(searches.createSavedSearch).mockResolvedValue({ success: true, data: savedSearch });
  vi.mocked(searches.updateSavedSearch).mockResolvedValue({ success: true, data: savedSearch });
  vi.mocked(searches.deleteSavedSearch).mockResolvedValue(done);
  vi.mocked(searches.dismissSearchHint).mockResolvedValue(done);
  vi.mocked(saved.querySavedPage).mockResolvedValue({ rows: [] });
  vi.mocked(query.queryRiverPage).mockResolvedValue(fixtures['items:query'].response);
  vi.mocked(query.queryFeedItems).mockResolvedValue([]);
  vi.mocked(settings.getRefreshInterval).mockResolvedValue(30);
  vi.mocked(settings.getRetentionDays).mockResolvedValue(30);
  vi.mocked(settings.getRefreshOnLaunch).mockResolvedValue(false);
  vi.mocked(settings.getWorkspaceRailExpanded).mockResolvedValue(false);
  vi.mocked(settings.getDetailedLogging).mockResolvedValue(false);
  discover.mockResolvedValue({ success: true, data: [source] });
  vi.mocked(resolveSource).mockReturnValue({ discover } as unknown as ReturnType<typeof resolveSource>);
  vi.mocked(getUpdateState).mockReturnValue({ name: 'NONE' });
  vi.mocked(refreshAllFeeds).mockResolvedValue(fixtures['feeds:refresh'].response);
  vi.mocked(openAndImportOpml).mockResolvedValue(imported);
  vi.mocked(exportWorkspaceOpml).mockResolvedValue(done);
  vi.mocked(getFeedpackCatalog).mockResolvedValue({ success: true, data: catalog });
  vi.mocked(previewFeedpack).mockResolvedValue({ success: true, data: preview });
  vi.mocked(installFeedpack).mockResolvedValue(imported);
  vi.mocked(getUsageAnalyticsState).mockResolvedValue(usageState);
  vi.mocked(changeUsageAnalyticsConsent).mockResolvedValue(usageState);
  vi.mocked(dismissUsageAnalyticsPrompt).mockResolvedValue(usageState);
  vi.mocked(previewSummary).mockResolvedValue(summary);
  vi.mocked(sampleErrorEvent).mockReturnValue(reportSample);
  vi.mocked(getErrorReportState).mockReturnValue({ enabled: true });
  vi.mocked(previewReportLog).mockResolvedValue(reportLog);
  vi.mocked(submitErrorReport).mockResolvedValue(done);
  vi.mocked(getAppInfo).mockResolvedValue(fixtures['app:get-info'].response);
  vi.mocked(readLanguageState).mockResolvedValue(languageState);
  vi.mocked(changeLanguage).mockResolvedValue(fixtures['settings:set'].response as typeof languageState);
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
    expect(fixture.delegate()).toHaveBeenCalledExactlyOnceWith(...fixture.calledWith);
    expect(response).toEqual(fixture.response);
    expect(structuredClone(response)).toEqual(response);
    expect(arg).toEqual(fixture.arg);
  });

  test.each(channels)('%s rejects an invalid payload before dispatch', async (channel) => {
    // Act
    const response: unknown = await registered(channel)(event, null);

    // Assert
    expect(response).toEqual(invalidPayload);
    expect(fixtures[channel].delegate()).not.toHaveBeenCalled();
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

describe('after hooks', () => {
  test('counts the first step of adding a feed, and a feed that was stored', async () => {
    // Act
    await registered('feeds:discover')(event, fixtures['feeds:discover'].arg);
    await registered('feeds:submit-add-feed')(event, newFeed);

    // Assert
    expect(vi.mocked(incrementCounter).mock.calls.map(([name]) => name)).toEqual(['feed_add_attempted', 'feeds_added', 'feed_add_succeeded']);
  });

  test('counts an address that holds no feed', async () => {
    // Arrange
    discover.mockResolvedValueOnce({ success: true, data: [] });

    // Act
    await registered('feeds:discover')(event, fixtures['feeds:discover'].arg);

    // Assert
    expect(vi.mocked(incrementCounter).mock.calls.map(([name]) => name)).toEqual(['feed_add_attempted', 'feed_add_failed_discovery_none']);
  });

  test('keeps the answer when a hook throws, and logs the failure', async () => {
    // Arrange
    vi.mocked(incrementCounter).mockImplementationOnce(() => {
      throw new Error('counter broke');
    });

    // Act
    const response: unknown = await registered('feeds:discover')(event, fixtures['feeds:discover'].arg);

    // Assert
    expect(response).toEqual(fixtures['feeds:discover'].response);
    expect(logger.warn).toHaveBeenCalledWith('operation.failure', { operation: 'after-feeds:discover' }, expect.any(Error));
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('settings channels', () => {
  test.each([
    ['refreshInterval', 60, settings.getRefreshInterval, settings.setRefreshInterval],
    ['refreshOnLaunch', true, settings.getRefreshOnLaunch, settings.setRefreshOnLaunch],
    ['workspaceRailExpanded', true, settings.getWorkspaceRailExpanded, settings.setWorkspaceRailExpanded],
    ['retentionDays', 60, settings.getRetentionDays, settings.setRetentionDays],
    ['detailedLogging', true, settings.getDetailedLogging, settings.setDetailedLogging],
  ] as const)('%s is read and written through its own setting', async (key, value, getter, setter) => {
    // Arrange
    vi.mocked(getter as (typeof settings)['getRefreshInterval']).mockResolvedValue(value as never);
    vi.mocked(refreshAllFeeds).mockResolvedValue({ perFeed: [] });

    // Act
    const read: unknown = await registered('settings:get')(event, { key });
    const written: unknown = await registered('settings:set')(event, { key, value });

    // Assert
    expect(read).toBe(value);
    expect(written).toBe(value);
    expect(setter).toHaveBeenCalledExactlyOnceWith(value);
  });

  test('reads and writes the language through the language module', async () => {
    // Act
    const read: unknown = await registered('settings:get')(event, { key: 'language' });
    await registered('settings:set')(event, { key: 'language', value: 'fr' });

    // Assert
    expect(read).toEqual(languageState);
    expect(changeLanguage).toHaveBeenCalledExactlyOnceWith('fr');
  });

  test('reads and writes the usage analytics consent through the consent module', async () => {
    // Act
    const read: unknown = await registered('settings:get')(event, { key: 'usageAnalytics' });
    await registered('settings:set')(event, { key: 'usageAnalytics', value: 'denied' });

    // Assert
    expect(read).toEqual(usageState);
    expect(changeUsageAnalyticsConsent).toHaveBeenCalledExactlyOnceWith('denied');
  });

  test('rejects a value that does not belong to the key before it stores anything', async () => {
    // Act
    const response: unknown = await registered('settings:set')(event, { key: 'refreshOnLaunch', value: 'fr' });

    // Assert
    expect(response).toEqual(invalidPayload);
    expect(settings.setRefreshOnLaunch).not.toHaveBeenCalled();
  });

  test('logs the key of a setting that failed', async () => {
    // Arrange
    const error = new Error('disk full');
    vi.mocked(settings.setRefreshOnLaunch).mockRejectedValueOnce(error);

    // Act
    await registered('settings:set')(event, { key: 'refreshOnLaunch', value: false });

    // Assert
    expect(logger.error).toHaveBeenCalledWith('ipc.failure', { channel: 'settings:set', incidentId: 'test-incident', setting: 'refreshOnLaunch' }, error);
  });
});

describe('usage counters', () => {
  test.each([
    ['items:get-content', 'articles_opened'],
    ['feeds:delete-feed', 'feeds_removed'],
    ['feeds:refresh', 'manual_refreshes'],
    ['items:set-saved', 'items_saved'],
    ['feedpacks:install', 'feedpacks_installed'],
    ['opml:import', 'opml_imported'],
    ['opml:export', 'opml_exported'],
    ['workspaces:create', 'workspaces_created'],
  ] as const)('%s counts %s after a successful request', async (channel, counter) => {
    // Act
    await registered(channel)(event, structuredClone(fixtures[channel].arg));

    // Assert
    expect(incrementCounter).toHaveBeenCalledExactlyOnceWith(counter);
  });

  test('counts a backup that finished', async () => {
    // Arrange
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'backup.db' });

    // Act
    await registered('app:back-up-database')(event, undefined);

    // Assert
    expect(incrementCounter).toHaveBeenCalledExactlyOnceWith('backups_made');
  });

  test('counts nothing for a failed result', async () => {
    // Arrange
    vi.mocked(insert.addFeedToDatabase).mockResolvedValueOnce({ success: false, error: { name: 'DUPLICATE_FEED', message: 'Exists.' } as never });

    // Act
    await registered('feeds:submit-add-feed')(event, fixtures['feeds:submit-add-feed'].arg);
    await registered('app:back-up-database')(event, undefined);

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });

  test('counts nothing when the handler throws', async () => {
    // Arrange
    vi.mocked(query.queryFeedItems).mockRejectedValueOnce(new Error('down'));

    // Act
    await registered('items:get-content')(event, 4);

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });

  test('counts an unsave for nothing', async () => {
    // Act
    await registered('items:set-saved')(event, { workspaceId: 1, itemId: 4, saved: false });

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });

  test('counts nothing for a channel without a counter', async () => {
    // Act
    await registered('feeds:list')(event, { workspaceId: 1 });

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });
});
