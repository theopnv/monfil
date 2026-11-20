// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { IpcMainInvokeEvent } from 'electron';
import type { UsageCounter } from '../../shared/contracts';
import type { ArgOf, InvokeChannel, ResultOf } from '../../shared/ipc-schema';
import { getAppInfo } from '../app/app-info';
import { getUpdateState } from '../updates/auto-updater';
import { dismissUsageAnalyticsPrompt } from '../analytics/consent';
import { previewSummary } from '../analytics/report';
import { createCategory, createWorkspace } from '../db/crud/insert';
import { deleteCategory, deleteFeedFromDatabase, deleteWorkspace } from '../db/crud/delete';
import { moveFeedsToCategory, moveFeedToWorkspace, renameCategory, reorderWorkspaces, setFeedsShowInWorkspace, setFeedItemsRead, updateWorkspace } from '../db/crud/update';
import { queryFeedCategory, queryFeedSummaries, queryRiverPage, queryWorkspaceSummaries } from '../db/crud/query';
import { createSavedSearch, deleteSavedSearch, dismissSearchHint, listSavedSearches, updateSavedSearch } from '../db/crud/searches';
import { querySavedPage, setItemSaved } from '../db/saved';
import { getFeedpackCatalog } from '../feedpacks/catalog';
import { installFeedpack, previewFeedpack } from '../feedpacks/install';
import { refreshAllFeeds } from '../feed/refresh';
import { resolveSource } from '../feed/sources/registry';
import { exportWorkspaceOpml } from '../opml/export';
import { openAndImportOpml } from '../opml/import';
import { handleAppBackUpDatabase, handleAppGetStartupHealth, handleFeedsSubmitAddFeed, handleItemsGetContent, handleSettingsGet, handleSettingsSet } from './handlers';

export interface Route<C extends InvokeChannel> {
  run: (arg: ArgOf<C>, event: IpcMainInvokeEvent) => ResultOf<C> | Promise<ResultOf<C>>;
  /** Counted after a request that did not fail. A function may decline to count. */
  counter?: UsageCounter | ((arg: ArgOf<C>) => UsageCounter | undefined);
}

/** One entry per invoke channel: a channel without an entry does not compile. */
export const routes = {
  'feeds:discover': { run: ({ query, type }) => resolveSource(query, type).discover(query) },
  'feeds:list-categories': { run: ({ workspaceId }) => queryFeedCategory({ workspace_id: workspaceId }) },
  'feeds:list': { run: ({ workspaceId }) => queryFeedSummaries(workspaceId) },
  'items:query': { run: (arg) => queryRiverPage(arg) },
  'saved:query': { run: (arg) => querySavedPage(arg) },
  'items:set-saved': { run: (arg) => setItemSaved(arg), counter: (arg) => (arg.saved ? 'items_saved' : undefined) },
  'feeds:refresh': { run: () => refreshAllFeeds(), counter: 'manual_refreshes' },
  'feeds:submit-add-feed': { run: (arg, event) => handleFeedsSubmitAddFeed(arg, event), counter: 'feeds_added' },
  'feeds:delete-feed': { run: ({ feedId, workspaceId }) => deleteFeedFromDatabase(feedId, workspaceId), counter: 'feeds_removed' },
  'feeds:set-show-in-workspace': { run: ({ feedIds, showInWorkspace, workspaceId }) => setFeedsShowInWorkspace(feedIds, showInWorkspace, workspaceId) },
  'feeds:create-category': { run: ({ name, workspaceId }) => createCategory(name, workspaceId) },
  'feeds:rename-category': { run: ({ categoryId, name, workspaceId }) => renameCategory(categoryId, name, workspaceId) },
  'feeds:delete-category': { run: ({ categoryId, reassignTo, workspaceId }) => deleteCategory(categoryId, workspaceId, reassignTo) },
  'feeds:move-feeds-to-category': { run: ({ feedIds, categoryId, workspaceId }) => moveFeedsToCategory(feedIds, categoryId, workspaceId) },
  'feeds:move-to-workspace': { run: ({ feedId, fromWorkspaceId, toWorkspaceId, categoryName }) => moveFeedToWorkspace(feedId, fromWorkspaceId, toWorkspaceId, categoryName) },
  'workspaces:list': { run: () => queryWorkspaceSummaries() },
  'workspaces:create': { run: ({ name, icon, color }) => createWorkspace(name, icon, color), counter: 'workspaces_created' },
  'workspaces:update': {
    run: ({ workspaceId, ...patch }) => updateWorkspace(workspaceId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    }),
  },
  'workspaces:delete': { run: ({ workspaceId }) => deleteWorkspace(workspaceId) },
  'workspaces:reorder': { run: ({ orderedIds }) => reorderWorkspaces(orderedIds) },
  'items:set-read': { run: ({ itemIds, read }) => setFeedItemsRead(itemIds, read) },
  'items:get-content': { run: (itemId) => handleItemsGetContent(itemId), counter: 'articles_opened' },
  'app:back-up-database': { run: () => handleAppBackUpDatabase(), counter: 'backups_made' },
  'app:get-info': { run: () => getAppInfo() },
  'app:get-startup-health': { run: () => handleAppGetStartupHealth() },
  'app:get-update-state': { run: () => getUpdateState() },
  'settings:get': { run: (arg) => handleSettingsGet(arg) },
  'settings:set': { run: (arg) => handleSettingsSet(arg) },
  'settings:dismiss-usage-analytics-prompt': { run: () => dismissUsageAnalyticsPrompt() },
  'analytics:preview': { run: () => previewSummary() },
  'opml:import': { run: ({ target }) => openAndImportOpml(target), counter: 'opml_imported' },
  'opml:export': { run: ({ workspaceId }) => exportWorkspaceOpml(workspaceId), counter: 'opml_exported' },
  'feedpacks:list': { run: () => getFeedpackCatalog() },
  'feedpacks:preview': { run: ({ slug }) => previewFeedpack(slug) },
  'feedpacks:install': { run: ({ slug, target }) => installFeedpack(slug, target), counter: 'feedpacks_installed' },
  'searches:list': { run: ({ workspaceId }) => listSavedSearches(workspaceId) },
  'searches:create': { run: ({ workspaceId, name, query }) => createSavedSearch(workspaceId, name, query) },
  'searches:update': {
    run: ({ searchId, ...patch }) => updateSavedSearch(searchId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.query !== undefined ? { query: patch.query } : {}),
    }),
  },
  'searches:delete': { run: ({ searchId }) => deleteSavedSearch(searchId) },
  'searches:dismiss-hint': { run: ({ workspaceId }) => dismissSearchHint(workspaceId) },
} satisfies { [C in InvokeChannel]: Route<C> };
