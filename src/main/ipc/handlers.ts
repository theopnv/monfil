// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { dialog } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { SettingGetArg, SettingKey, SettingSetArg, SettingState, SettingTypes } from '../../shared/channels';
import type { BackupError, ItemBody, RetentionDays, StartupHealth } from '../../shared/contracts';
import type { ArgOf, ResultOf } from '../../shared/ipc-schema';
import { fail, ok, type Result } from '../../shared/result';
import { changeUsageAnalyticsConsent, getUsageAnalyticsState } from '../analytics/consent';
import { incrementCounter } from '../analytics/counters';
import {
  getDetailedLogging,
  getRefreshInterval,
  getRefreshOnLaunch,
  getRetentionDays,
  getWorkspaceRailExpanded,
  setDetailedLogging,
  setRefreshInterval,
  setRefreshOnLaunch,
  setRetentionDays,
  setWorkspaceRailExpanded,
  toRefreshInterval,
  toRetentionDays,
} from '../app/settings';
import { changeLanguage, readLanguageState } from '../app/language';
import { updateFeedItemImage, upsertArticleContent, addFeedToDatabase } from '../db/crud/insert';
import { queryArticleContent, queryFeedItems, queryFeedMetadata } from '../db/crud/query';
import type { ArticleContent } from '../db/types';
import { backUpDatabase, dbReady, dbStatus } from '../db/database';
import { pruneExpiredItems, retainedFetchedItems, retentionCutoff } from '../db/retention';
import { enrichItems } from '../feed/enrichItems';
import { deriveArticleContentStatus } from '../feed/extractArticle';
import { extractArticleInUtilityProcess } from '../feed/extractArticleUtility';
import { refreshAllFeeds } from '../feed/refresh';
import { rescheduleRefresh } from '../feed/scheduler';
import { sourceFor } from '../feed/sources/registry';
import { ARTICLE_FETCH_RETRY_MS, ARTICLE_FETCH_TIMEOUT_MS } from '../lib/constants';
import { fetchText } from '../lib/fetch';
import { mainI18n } from '../lib/i18n';
import { broadcastToRenderers, sendToRenderer } from '../lib/sendToRenderer';
import { logger, setDetailedLogging as applyDetailedLogging } from '../logging/logger';

export async function handleFeedsSubmitAddFeed(payload: ArgOf<'feeds:submit-add-feed'>, event: IpcMainInvokeEvent): Promise<ResultOf<'feeds:submit-add-feed'>> {
  const cutoff = retentionCutoff(await getRetentionDays());
  const result = await addFeedToDatabase({ ...payload, items: retainedFetchedItems(payload.items, cutoff) }, cutoff);
  if (!result.success) {
    return result;
  }

  const { items, category, ...metadata } = result.data;
  if (sourceFor(payload.type).fetchesFullArticle) {
    void enrichItems(items, (item, image) => {
      void updateFeedItemImage(item.id, image);
      sendToRenderer(event.sender, 'feeds:item-image-fetched', { feedId: metadata.id, itemId: item.id, image });
    });
  }

  return {
    success: true,
    data: { ...metadata, category, itemCount: items.length, unreadCount: items.filter((item) => !item.read_at).length },
  };
}

/**
 * Resolves an item's raw description plus, for sources the registry marks as `fetchesFullArticle`,
 * its extracted full article, fetching and storing it on the first request. A `failed` or `too_short`
 * row on file is left out of the response without a retry, so a page that never works is not refetched
 * on every open. A `fetch_failed` row (offline, timeout, server error) is refetched once it is older
 * than `ARTICLE_FETCH_RETRY_MS`.
 */
export async function handleItemsGetContent(itemId: number): Promise<ItemBody> {
  const [item] = await queryFeedItems({ id: itemId });
  if (!item) {
    return { description: '', article: undefined };
  }

  const [feed] = await queryFeedMetadata({ id: item.feed_id });
  if (!feed || !sourceFor(feed.type).fetchesFullArticle) {
    return { description: item.description, article: undefined };
  }

  const [existing] = await queryArticleContent({ item_id: itemId });
  if (existing && !isRetryable(existing)) {
    return {
      description: item.description,
      article: existing.status === 'ok' && existing.html && existing.word_count
        ? { html: existing.html, wordCount: existing.word_count }
        : undefined,
    };
  }

  if (!item.link) {
    return { description: item.description, article: undefined };
  }

  const fetched = await fetchText(item.link, { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
  if (!fetched.success) {
    const status = fetched.error.name === 'BLOCKED_URL_ERROR' ? 'failed' : 'fetch_failed';
    await upsertArticleContent({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status, attempted_at: Date.now() });
    return { description: item.description, article: undefined };
  }

  let article;
  try {
    article = await extractArticleInUtilityProcess(fetched.data.body, item.link);
  } catch (error) {
    logger.error('operation.failure', { operation: 'extract-article', entityId: itemId }, error);
  }
  const status = deriveArticleContentStatus(article);
  await upsertArticleContent({ item_id: itemId, html: article?.html, text: article?.text, word_count: article?.wordCount, status, attempted_at: Date.now() });
  void incrementCounter('fulltext_extracted');

  return {
    description: item.description,
    article: status === 'ok' && article ? { html: article.html, wordCount: article.wordCount } : undefined,
  };
}

function isRetryable(row: ArticleContent): boolean {
  return row.status === 'fetch_failed' && Date.now() - row.attempted_at >= ARTICLE_FETCH_RETRY_MS;
}

type SettingRoute<K extends SettingKey> = {
  get: () => Promise<SettingTypes[K]['state']>;
  set: (value: SettingTypes[K]['value']) => Promise<SettingTypes[K]['state']>;
};

function plainSetting<T>(get: () => Promise<T>, set: (value: T) => Promise<void>): { get: () => Promise<T>; set: (value: T) => Promise<T> } {
  return {
    get,
    async set(value) {
      await set(value);
      return value;
    },
  };
}

async function setRetention(value: RetentionDays): Promise<RetentionDays> {
  const days = toRetentionDays(value);
  const previous = await getRetentionDays();
  await setRetentionDays(days);
  const removed = await pruneExpiredItems(days);
  if (days > previous) {
    const refreshed = await refreshAllFeeds(true);
    broadcastToRenderers('feeds:refreshed', { ...refreshed, removed: (refreshed.removed ?? 0) + removed, applyImmediately: true });
  } else if (removed > 0) {
    broadcastToRenderers('feeds:refreshed', { perFeed: [], removed, applyImmediately: true });
  }
  return days;
}

const settingRoutes: { [K in SettingKey]: SettingRoute<K> } = {
  refreshInterval: {
    get: getRefreshInterval,
    async set(value) {
      const interval = toRefreshInterval(value);
      await setRefreshInterval(interval);
      rescheduleRefresh(interval);
      return interval;
    },
  },
  refreshOnLaunch: plainSetting(getRefreshOnLaunch, setRefreshOnLaunch),
  workspaceRailExpanded: plainSetting(getWorkspaceRailExpanded, setWorkspaceRailExpanded),
  retentionDays: { get: getRetentionDays, set: setRetention },
  detailedLogging: plainSetting(getDetailedLogging, async (value) => {
    await setDetailedLogging(value);
    applyDetailedLogging(value);
  }),
  language: { get: readLanguageState, set: changeLanguage },
  usageAnalytics: { get: getUsageAnalyticsState, set: changeUsageAnalyticsConsent },
};

function setSetting<K extends SettingKey>(key: K, value: SettingTypes[K]['value']): Promise<SettingTypes[K]['state']> {
  return settingRoutes[key].set(value);
}

export function handleSettingsGet(payload: SettingGetArg): Promise<SettingState> {
  return settingRoutes[payload.key].get();
}

export function handleSettingsSet(payload: SettingSetArg): Promise<SettingState> {
  return setSetting(payload.key, payload.value);
}

export async function handleAppBackUpDatabase(): Promise<Result<void, BackupError>> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `monfil-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: mainI18n.t('main:dialog.sqliteFilter'), extensions: ['db'] }],
  });
  if (canceled || !filePath) {
    return fail('CANCELLED', 'Backup cancelled.');
  }
  try {
    await backUpDatabase(filePath);
    return ok();
  } catch (error) {
    return fail('BACKUP_FAILED', error instanceof Error ? error.message : String(error));
  }
}

export async function handleAppGetStartupHealth(): Promise<StartupHealth> {
  try {
    await dbReady;
  } catch {
    // dbStatus contains the safe failure state returned below.
  }
  if (dbStatus.name === 'OK') {
    return dbStatus;
  }
  return { name: dbStatus.name, incidentId: dbStatus.incidentId };
}
