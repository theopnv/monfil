// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { SettingGetArg, SettingKey, SettingSetArg, SettingState, SettingTypes } from './channels';
import type {
  AddFeedError,
  AppInfo,
  AppUpdateState,
  CatalogError,
  CreateCategoryError,
  CreateWorkspaceError,
  DailySummaryProps,
  DeleteCategoryError,
  DeleteFeedError,
  DeleteWorkspaceError,
  ExportOpmlError,
  FeedCategory,
  FeedFetchError,
  FeedpackCatalog,
  FeedpackError,
  FeedpackInstallTarget,
  FeedpackPreview,
  FeedSummary,
  ImportOpmlError,
  ImportOpmlTarget,
  ImportSummary,
  InstallFeedpackError,
  ItemBody,
  MoveFeedError,
  NewFeedInput,
  ParsedSource,
  RefreshInterval,
  RefreshSummary,
  RetentionDays,
  RiverPage,
  RiverQuery,
  SavedQuery,
  SavedSearch,
  SavedSearchError,
  SavedSearchList,
  UpdateSavedItemError,
  SourceType,
  StartupHealth,
  UpdateCategoryError,
  UpdateFeedError,
  UpdateItemError,
  UpdateWorkspaceError,
  UsageAnalyticsState,
  Workspace,
  WorkspaceSummary,
  BackupError,
  RiverCursor,
  SavedCursor,
  SourceItem,
  DismissSearchHintError,
} from './contracts';
import { REFRESH_INTERVALS, RETENTION_OPTIONS, SOURCE_TYPES } from './contracts';
import type { IpcFailure, Result } from './result';
import { isLanguageSetting } from './i18n/languages';
import { array, isBoolean, isFiniteNumber, isPositiveSafeInteger, isString, isUndefined, object, optional, type Guard } from './guards';

/** One invoke channel: the guard that checks its argument, and the type of what it returns. `result` only carries the type. */
export interface Rpc<A, R> {
  guard: Guard<A>;
  result?: R;
}

const returns = <R>() => <A>(guard: Guard<A>): Rpc<A, R> => ({ guard });

function isSourceType(value: unknown): value is SourceType {
  return (SOURCE_TYPES as readonly unknown[]).includes(value);
}

function isRefreshInterval(value: unknown): value is RefreshInterval {
  return (REFRESH_INTERVALS as readonly unknown[]).includes(value);
}

function isRetentionDays(value: unknown): value is RetentionDays {
  return (RETENTION_OPTIONS as readonly unknown[]).includes(value);
}

function isConsentChoice(value: unknown): value is 'granted' | 'denied' {
  return value === 'granted' || value === 'denied';
}

const settingValueGuards: { [K in SettingKey]: Guard<SettingTypes[K]['value']> } = {
  refreshInterval: isRefreshInterval,
  refreshOnLaunch: isBoolean,
  workspaceRailExpanded: isBoolean,
  retentionDays: isRetentionDays,
  detailedLogging: isBoolean,
  language: isLanguageSetting,
  usageAnalytics: isConsentChoice,
};

function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === 'string' && Object.hasOwn(settingValueGuards, value);
}

const isSettingGet = object<SettingGetArg>({ key: isSettingKey });

const isSettingEnvelope = object<{ key: SettingKey; value: unknown }>({ key: isSettingKey, value: (_value): _value is unknown => true });

function isSettingSet(value: unknown): value is SettingSetArg {
  return isSettingEnvelope(value) && settingValueGuards[value.key](value.value);
}

const isSourceItem = object<SourceItem>({
  title: isString, guid: isString, link: optional(isString), pubDate: isString, description: isString,
  image: optional(isString), author: optional(isString), extra: optional(isString), read_at: optional(isString),
});
const isNewFeedInput = object<NewFeedInput>({
  link: isString, title: isString, type: isSourceType, items: array(isSourceItem), categoryName: isString,
  workspaceId: isPositiveSafeInteger, showInWorkspace: isBoolean, icon: optional(isString),
});
const isCursor = object<RiverCursor>({ publishedAt: isFiniteNumber, id: isPositiveSafeInteger, savedAt: optional(isFiniteNumber) });
const isIds = array(isPositiveSafeInteger);
const isRiverQuery = object<RiverQuery>({
  workspaceId: isPositiveSafeInteger, feedIds: optional(isIds), ids: optional(isIds), unreadOnly: optional(isBoolean),
  search: optional(isString), cursor: optional(isCursor), limit: isPositiveSafeInteger,
});
const isSavedCursor = object<SavedCursor>({ publishedAt: isFiniteNumber, id: isPositiveSafeInteger, savedAt: isFiniteNumber });
const isSavedQuery = object<SavedQuery>({
  workspaceId: isPositiveSafeInteger, ids: optional(isIds), unreadOnly: optional(isBoolean),
  search: optional(isString), cursor: optional(isSavedCursor), limit: isPositiveSafeInteger,
});
const isWorkspace = object<{ workspaceId: number }>({ workspaceId: isPositiveSafeInteger });
const isMergeTarget = object<Extract<ImportOpmlTarget, { kind: 'merge-workspace' }>>({
  kind: (value): value is 'merge-workspace' => value === 'merge-workspace', workspaceId: isPositiveSafeInteger,
});
const newWorkspaceFields = {
  kind: (value: unknown): value is 'new-workspace' => value === 'new-workspace', name: isString, icon: isString, color: isString,
};
const isNewImportTarget = object<Extract<ImportOpmlTarget, { kind: 'new-workspace' }>>({
  ...newWorkspaceFields, sourceSlug: optional(isString), sourceVersion: optional(isString),
});
const isNewFeedpackTarget = object<Extract<FeedpackInstallTarget, { kind: 'new-workspace' }>>(newWorkspaceFields);

function isImportTarget(value: unknown): value is ImportOpmlTarget {
  return isMergeTarget(value) || isNewImportTarget(value);
}

function isFeedpackTarget(value: unknown): value is FeedpackInstallTarget {
  return isMergeTarget(value) || isNewFeedpackTarget(value);
}

export const ipcSchema = {
  'feeds:discover': returns<Result<ParsedSource[], FeedFetchError>>()(object<{ query: string; type?: SourceType }>({ query: isString, type: optional(isSourceType) })),
  'feeds:list-categories': returns<FeedCategory[]>()(isWorkspace),
  'feeds:list': returns<FeedSummary[]>()(isWorkspace),
  'items:query': returns<RiverPage>()(isRiverQuery),
  'saved:query': returns<RiverPage>()(isSavedQuery),
  'items:set-saved': returns<Result<void, UpdateSavedItemError>>()(object({ workspaceId: isPositiveSafeInteger, itemId: isPositiveSafeInteger, saved: isBoolean })),
  'feeds:refresh': returns<RefreshSummary>()(isUndefined),
  'feeds:submit-add-feed': returns<Result<FeedSummary, AddFeedError>>()(isNewFeedInput),
  'feeds:delete-feed': returns<Result<void, DeleteFeedError>>()(object({ feedId: isPositiveSafeInteger, workspaceId: isPositiveSafeInteger })),
  'feeds:set-show-in-workspace': returns<Result<void, UpdateFeedError>>()(object({ feedIds: isIds, showInWorkspace: isBoolean, workspaceId: isPositiveSafeInteger })),
  'feeds:create-category': returns<Result<FeedCategory, CreateCategoryError>>()(object({ name: isString, workspaceId: isPositiveSafeInteger })),
  'feeds:rename-category': returns<Result<FeedCategory, UpdateCategoryError>>()(object({ categoryId: isPositiveSafeInteger, name: isString, workspaceId: isPositiveSafeInteger })),
  'feeds:delete-category': returns<Result<void, DeleteCategoryError>>()(object<{ categoryId: number; reassignTo?: number | undefined; workspaceId: number }>({ categoryId: isPositiveSafeInteger, reassignTo: optional(isPositiveSafeInteger), workspaceId: isPositiveSafeInteger })),
  'feeds:move-feeds-to-category': returns<Result<void, UpdateCategoryError>>()(object({ feedIds: isIds, categoryId: isPositiveSafeInteger, workspaceId: isPositiveSafeInteger })),
  'feeds:move-to-workspace': returns<Result<void, MoveFeedError>>()(object({ feedId: isPositiveSafeInteger, fromWorkspaceId: isPositiveSafeInteger, toWorkspaceId: isPositiveSafeInteger, categoryName: isString })),
  'workspaces:list': returns<WorkspaceSummary[]>()(isUndefined),
  'workspaces:create': returns<Result<Workspace, CreateWorkspaceError>>()(object({ name: isString, icon: isString, color: isString })),
  'workspaces:update': returns<Result<Workspace, UpdateWorkspaceError>>()(object<{ workspaceId: number; name?: string; icon?: string; color?: string }>({ workspaceId: isPositiveSafeInteger, name: optional(isString), icon: optional(isString), color: optional(isString) })),
  'workspaces:delete': returns<Result<void, DeleteWorkspaceError>>()(isWorkspace),
  'workspaces:reorder': returns<Result<void, UpdateWorkspaceError>>()(object({ orderedIds: isIds })),
  'items:set-read': returns<Result<void, UpdateItemError>>()(object({ itemIds: isIds, read: isBoolean })),
  'items:get-content': returns<ItemBody>()(isPositiveSafeInteger),
  'app:back-up-database': returns<Result<void, BackupError>>()(isUndefined),
  'app:get-info': returns<AppInfo>()(isUndefined),
  'app:get-startup-health': returns<StartupHealth>()(isUndefined),
  'app:get-update-state': returns<AppUpdateState>()(isUndefined),
  'settings:get': returns<SettingState>()(isSettingGet),
  'settings:set': returns<SettingState>()(isSettingSet),
  'settings:dismiss-usage-analytics-prompt': returns<UsageAnalyticsState>()(isUndefined),
  'analytics:preview': returns<DailySummaryProps>()(isUndefined),
  'opml:import': returns<Result<ImportSummary, ImportOpmlError>>()(object({ target: isImportTarget })),
  'opml:export': returns<Result<void, ExportOpmlError>>()(isWorkspace),
  'feedpacks:list': returns<Result<FeedpackCatalog, CatalogError>>()(isUndefined),
  'feedpacks:preview': returns<Result<FeedpackPreview, FeedpackError>>()(object({ slug: isString })),
  'feedpacks:install': returns<Result<ImportSummary, InstallFeedpackError>>()(object({ slug: isString, target: isFeedpackTarget })),
  'searches:list': returns<SavedSearchList>()(isWorkspace),
  'searches:create': returns<Result<SavedSearch, SavedSearchError>>()(object({ workspaceId: isPositiveSafeInteger, name: isString, query: isString })),
  'searches:update': returns<Result<SavedSearch, SavedSearchError>>()(object<{ searchId: number; name?: string; query?: string }>({ searchId: isPositiveSafeInteger, name: optional(isString), query: optional(isString) })),
  'searches:delete': returns<Result<void, SavedSearchError>>()(object({ searchId: isPositiveSafeInteger })),
  'searches:dismiss-hint': returns<Result<void, DismissSearchHintError>>()(isWorkspace),
};

export type InvokeChannel = keyof typeof ipcSchema;
export type ArgOf<C extends InvokeChannel> = (typeof ipcSchema)[C] extends Rpc<infer A, unknown> ? A : never;
export type ResultOf<C extends InvokeChannel> = (typeof ipcSchema)[C] extends Rpc<unknown, infer R> ? R : never;
export type IpcInvokeResponse<C extends InvokeChannel> = ResultOf<C> | IpcFailure;
