// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type {
  AppUpdateState,
  LanguageState,
  RefreshInterval,
  RendererUsageCounter,
  RefreshSummary,
  RetentionDays,
  UsageAnalyticsState,
  UsagePreferences,
} from './contracts';
import type { LanguageSetting } from './i18n/languages';
import type { LogEventMap, LogEventName, LogLevel } from './logging';

export type SettingTypes = {
  refreshInterval: { value: RefreshInterval; state: RefreshInterval };
  refreshOnLaunch: { value: boolean; state: boolean };
  workspaceRailExpanded: { value: boolean; state: boolean };
  retentionDays: { value: RetentionDays; state: RetentionDays };
  detailedLogging: { value: boolean; state: boolean };
  language: { value: LanguageSetting; state: LanguageState };
  usageAnalytics: { value: 'granted' | 'denied'; state: UsageAnalyticsState };
};

export type SettingKey = keyof SettingTypes;
export type SettingState = SettingTypes[SettingKey]['state'];
export type SettingGetArg = { key: SettingKey };
export type SettingSetArg = { [K in SettingKey]: { key: K; value: SettingTypes[K]['value'] } }[SettingKey];

export type RevealTarget = 'database' | 'log' | 'database-backup';

export type MenuActions = { feed: 'move' | 'delete'; category: 'rename' | 'delete'; workspace: 'edit' | 'export' | 'delete' };
export type MenuKind = keyof MenuActions;
export type MenuTarget = { kind: MenuKind; id: number };
export type MenuAction = { [K in MenuKind]: { kind: K; action: MenuActions[K]; id: number } }[MenuKind];

export type OneWayRendererToMainChannelPayloads = {
  'link:open': string;
  'menu:show': MenuTarget;
  'app:reveal': RevealTarget;
  'app:restart': undefined;
  'app:install-update': undefined;
  'app:set-window-theme': 'light' | 'dark';
  'log:write': { level: LogLevel; event: LogEventName; data: LogEventMap[LogEventName]; error?: string };
  'usage:record': { counter: RendererUsageCounter };
  'usage:preferences': UsagePreferences;
};

export type OneWayRendererToMainChannels = keyof OneWayRendererToMainChannelPayloads;

export type OneWayMainToRendererChannelPayloads = {
  'feeds:item-image-fetched': { feedId: number; itemId: number; image: string };
  'feeds:refreshed': RefreshSummary;
  'menu:action': MenuAction;
  'feedpacks:install-finished': { workspaceId: number; imported: number; failed: { title: string; message: string }[] };
  'app:update-state-changed': AppUpdateState;
};

export type OneWayMainToRendererChannels = keyof OneWayMainToRendererChannelPayloads;
