// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TwoWayRendererMainChannels, TwoWayRendererMainChannelsInvokeArgs } from './channels';
import type { FeedpackInstallTarget, ImportOpmlTarget, NewFeedInput, RefreshInterval, RetentionDays, RiverCursor, RiverQuery, SourceItem, SourceType } from './contracts';
import { isPositiveSafeInteger } from './validation';

type Guard<T> = (value: unknown) => value is T;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optional<T>(guard: Guard<T>): Guard<T | undefined> {
  return (value): value is T | undefined => value === undefined || guard(value);
}

function array<T>(guard: Guard<T>): Guard<T[]> {
  return (value): value is T[] => {
    if (!Array.isArray(value)) {
      return false;
    }
    for (const item of value) {
      if (!guard(item)) {
        return false;
      }
    }
    return true;
  };
}

function object<T extends object>(fields: { [K in keyof T]-?: Guard<T[K]> }): Guard<T> {
  return (value): value is T => {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    if (Reflect.ownKeys(value).some((key) => !Object.hasOwn(fields, key))) {
      return false;
    }
    const record = value as Record<keyof T, unknown>;
    return (Object.keys(fields) as (keyof T)[]).every((key) => fields[key](record[key]));
  };
}

function isSourceType(value: unknown): value is SourceType {
  return value === 'rss' || value === 'youtube';
}

function isRefreshInterval(value: unknown): value is RefreshInterval {
  return value === 15 || value === 30 || value === 60 || value === 360 || value === 'manual';
}

function isRetentionDays(value: unknown): value is RetentionDays {
  return value === 15 || value === 30 || value === 60 || value === 90 || value === 180;
}

const isSourceItem = object<SourceItem>({
  title: isString, guid: isString, link: optional(isString), pubDate: isString, description: isString,
  image: optional(isString), author: optional(isString), extra: optional(isString), read_at: optional(isString),
});
const isNewFeedInput = object<NewFeedInput>({
  link: isString, title: isString, type: isSourceType, items: array(isSourceItem), categoryName: isString,
  workspaceId: isPositiveSafeInteger, showInWorkspace: isBoolean, icon: optional(isString),
});
const isCursor = object<RiverCursor>({ publishedAt: isFiniteNumber, id: isPositiveSafeInteger });
const isIds = array(isPositiveSafeInteger);
const isRiverQuery = object<RiverQuery>({
  workspaceId: isPositiveSafeInteger, feedIds: optional(isIds), ids: optional(isIds), unreadOnly: optional(isBoolean),
  search: optional(isString), cursor: optional(isCursor), limit: isPositiveSafeInteger,
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

export const invokePayloadGuards: { [C in TwoWayRendererMainChannels]: Guard<TwoWayRendererMainChannelsInvokeArgs[C]> } = {
  'feeds:validate-feed-url': object<TwoWayRendererMainChannelsInvokeArgs['feeds:validate-feed-url']>({ query: isString, type: optional(isSourceType) }),
  'feeds:list-categories': isWorkspace,
  'feeds:list': isWorkspace,
  'items:query': isRiverQuery,
  'feeds:refresh': isUndefined,
  'feeds:submit-add-feed': isNewFeedInput,
  'feeds:delete-feed': object({ feedId: isPositiveSafeInteger, workspaceId: isPositiveSafeInteger }),
  'feeds:set-show-in-workspace': object({ feedIds: isIds, showInWorkspace: isBoolean, workspaceId: isPositiveSafeInteger }),
  'feeds:create-category': object({ name: isString, workspaceId: isPositiveSafeInteger }),
  'feeds:rename-category': object({ categoryId: isPositiveSafeInteger, name: isString, workspaceId: isPositiveSafeInteger }),
  'feeds:delete-category': object({ categoryId: isPositiveSafeInteger, reassignTo: isPositiveSafeInteger, workspaceId: isPositiveSafeInteger }),
  'feeds:move-feeds-to-category': object({ feedIds: isIds, categoryId: isPositiveSafeInteger, workspaceId: isPositiveSafeInteger }),
  'feeds:move-to-workspace': object({ feedId: isPositiveSafeInteger, fromWorkspaceId: isPositiveSafeInteger, toWorkspaceId: isPositiveSafeInteger, categoryName: isString }),
  'workspaces:list': isUndefined,
  'workspaces:create': object({ name: isString, icon: isString, color: isString }),
  'workspaces:update': object<TwoWayRendererMainChannelsInvokeArgs['workspaces:update']>({ workspaceId: isPositiveSafeInteger, name: optional(isString), icon: optional(isString), color: optional(isString) }),
  'workspaces:delete': isWorkspace,
  'workspaces:reorder': object({ orderedIds: isIds }),
  'settings:get-refresh-interval': isUndefined,
  'settings:set-refresh-interval': isRefreshInterval,
  'items:set-read': object({ itemIds: isIds, read: isBoolean }),
  'items:get-content': isPositiveSafeInteger,
  'settings:get-refresh-on-launch': isUndefined,
  'settings:set-refresh-on-launch': isBoolean,
  'settings:get-retention-days': isUndefined,
  'settings:set-retention-days': isRetentionDays,
  'app:back-up-database': isUndefined,
  'app:get-info': isUndefined,
  'app:get-startup-health': isUndefined,
  'settings:get-detailed-logging': isUndefined,
  'settings:set-detailed-logging': isBoolean,
  'opml:import': object({ target: isImportTarget }),
  'opml:export': isWorkspace,
  'feedpacks:list': isUndefined,
  'feedpacks:preview': object({ slug: isString }),
  'feedpacks:install': object({ slug: isString, target: isFeedpackTarget }),
};
