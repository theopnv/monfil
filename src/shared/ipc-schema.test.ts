// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { isMenuTarget, isRevealTarget, isUsagePreferences } from './ipc-payloads';
import { ipcSchema, type InvokeChannel } from './ipc-schema';
import type { NewFeedInput, SourceItem } from './contracts';

const item: SourceItem = {
  title: 'Item', guid: 'item', link: undefined, pubDate: 'invalid-date', description: '',
  image: undefined, author: undefined, extra: undefined, read_at: undefined,
};
const feed: NewFeedInput = {
  link: 'https://example.com/feed', title: 'Feed', type: 'rss', items: [item],
  categoryName: '', workspaceId: 1, showInWorkspace: true,
};

describe('language payloads', () => {
  test.each(['system', 'en', 'fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar'])('accepts the choice %j', (choice) => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'language', value: choice })).toBe(true);
  });

  test.each(['pt-BR', 'zh-Hans', 'klingon', '', null, undefined, 3, { language: 'fr' }])('rejects the choice %j', (choice) => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'language', value: choice })).toBe(false);
  });

  test('reads a setting by its key only', () => {
    // Act & Assert
    expect(ipcSchema['settings:get'].guard({ key: 'language' })).toBe(true);
    expect(ipcSchema['settings:get'].guard(undefined)).toBe(false);
    expect(ipcSchema['settings:get'].guard({ key: 'unknown' })).toBe(false);
    expect(ipcSchema['settings:get'].guard({ key: 'language', value: 'fr' })).toBe(false);
  });

  test('rejects a write without a value or with an unknown key', () => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'language' })).toBe(false);
    expect(ipcSchema['settings:set'].guard({ key: 'unknown', value: true })).toBe(false);
    expect(ipcSchema['settings:set'].guard({ key: 'language', value: 'fr', extra: 1 })).toBe(false);
  });

  test('checks the value against the key it is written to', () => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'refreshOnLaunch', value: 'fr' })).toBe(false);
    expect(ipcSchema['settings:set'].guard({ key: 'language', value: true })).toBe(false);
    expect(ipcSchema['settings:set'].guard({ key: 'toString', value: true })).toBe(false);
  });
});

describe('IPC payload guards', () => {
  test.each([
    { workspaceId: 1, itemId: 0, saved: true },
    { workspaceId: 1, itemId: 1, saved: 'true' },
    { workspaceId: 0, itemId: 1, saved: true },
    { workspaceId: 1, itemId: 1, saved: true, extra: true },
  ])('rejects malformed saved state %j', (arg) => {
    // Act
    const valid = ipcSchema['items:set-saved'].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each([
    { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0 } },
    { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0, savedAt: NaN } },
    { workspaceId: 1, limit: 50, feedIds: [1] },
  ])('rejects malformed Saved query %j', (arg) => {
    // Act
    const valid = ipcSchema['saved:query'].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts a Saved cursor and saved state', () => {
    // Act
    const queryValid = ipcSchema['saved:query'].guard({ workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0, savedAt: 10 } });
    const stateValid = ipcSchema['items:set-saved'].guard({ workspaceId: 1, itemId: 1, saved: false });

    // Assert
    expect(queryValid && stateValid).toBe(true);
  });
  test.each([{}, [], new Date(), new Map(), { workspaceId: 1, extra: true }, { workspaceId: 1, constructor: '' }, { workspaceId: 1, [Symbol('extra')]: true }, Object.create({ workspaceId: 1 }) as unknown])('rejects malformed workspace object %j', (arg) => {
    // Act
    const valid = ipcSchema['feeds:list'].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each(Object.keys(item))('rejects a wrong type for feed item field %s', (field) => {
    // Arrange
    const arg = { ...feed, items: [{ ...item, [field]: 42 }] };

    // Act
    const valid = ipcSchema['feeds:submit-add-feed'].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each(['title', 'guid', 'pubDate', 'description'])('requires feed item field %s', (field) => {
    // Arrange
    const partial = Object.fromEntries(Object.entries(item).filter(([key]) => key !== field));

    // Act
    const valid = ipcSchema['feeds:submit-add-feed'].guard({ ...feed, items: [partial] });

    // Assert
    expect(valid).toBe(false);
  });

  test.each([null, {}, [null], new Array<unknown>(1), [{ ...item, extraField: true }]].map((items) => ({ items })))('rejects malformed item collection %j', ({ items }) => {
    // Act
    const valid = ipcSchema['feeds:submit-add-feed'].guard({ ...feed, items });

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts missing feed dates and optional metadata as strings or undefined', () => {
    // Arrange
    const arg = { ...feed, type: 'youtube', icon: undefined, items: [{ ...item, pubDate: '', extra: '{}' }] };

    // Act
    const valid = ipcSchema['feeds:submit-add-feed'].guard(structuredClone(arg));

    // Assert
    expect(valid).toBe(true);
  });

  test.each([[], [0], [NaN], [1.5], ['1'], new Array<unknown>(1)].map((itemIds) => ({ itemIds })))('checks IDs inside arrays %j', ({ itemIds }) => {
    // Act
    const valid = ipcSchema['items:set-read'].guard({ itemIds, read: false });

    // Assert
    expect(valid).toBe(itemIds.length === 0);
  });

  test.each([
    { workspaceId: 1, limit: 0 },
    { workspaceId: 1, limit: 1.5 },
    { workspaceId: 1, limit: Infinity },
    { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: NaN } },
    { workspaceId: 1, limit: 50, cursor: { id: 0, publishedAt: 0 } },
    { workspaceId: 1, limit: 50, cursor: { id: 1 } },
    { workspaceId: 1, limit: 50, ids: [0] },
    { workspaceId: 1, limit: 50, feedIds: ['1'] },
    { workspaceId: 1, limit: 50, unreadOnly: 1 },
    { workspaceId: 1, limit: 50, search: null },
  ])('rejects malformed query %j', (arg) => {
    // Act
    const valid = ipcSchema['items:query'].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts optional query fields and timestamps before the Unix epoch', () => {
    // Arrange
    const arg = { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: -1 }, feedIds: [], ids: undefined, search: undefined, unreadOnly: false };

    // Act
    const valid = ipcSchema['items:query'].guard(structuredClone(arg));

    // Assert
    expect(valid).toBe(true);
  });

  test.each([15, 30, 60, 360, 'manual'])('accepts refresh interval %s', (arg) => {
    // Act
    const valid = ipcSchema['settings:set'].guard({ key: 'refreshInterval', value: arg });

    // Assert
    expect(valid).toBe(true);
  });

  test.each([15, 30, 60, 90, 180])('accepts retention period %s', (arg) => {
    // Act
    const valid = ipcSchema['settings:set'].guard({ key: 'retentionDays', value: arg });

    // Assert
    expect(valid).toBe(true);
  });

  test.each([
    ['settings:set', { key: 'refreshInterval', value: '30' }], ['settings:set', { key: 'refreshInterval', value: 90 }],
    ['settings:set', { key: 'retentionDays', value: '30' }], ['settings:set', { key: 'retentionDays', value: 360 }],
    ['settings:set', { key: 'detailedLogging', value: 1 }], ['settings:set', { key: 'refreshOnLaunch', value: 'false' }],
    ['feeds:discover', { query: 'https://example.com', type: 'json' }],
    ['workspaces:update', { workspaceId: 1, icon: 42 }],
    ['feeds:submit-add-feed', { ...feed, showInWorkspace: 1 }],
  ] satisfies [InvokeChannel, unknown][])('rejects a wrong value on %s', (channel, arg) => {
    // Act
    const valid = ipcSchema[channel].guard(arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each([
    { kind: 'merge-workspace', workspaceId: 1 },
    { kind: 'new-workspace', name: '', icon: '', color: '' },
  ])('accepts import and feedpack target %j', (target) => {
    // Act
    const importValid = ipcSchema['opml:import'].guard({ target });
    const installValid = ipcSchema['feedpacks:install'].guard({ slug: 'tech', target });

    // Assert
    expect(importValid && installValid).toBe(true);
  });

  test.each([{}, { kind: 'other' }, { kind: 'merge-workspace', workspaceId: 0 }, { kind: 'new-workspace', name: '', icon: '' }, { kind: 'merge-workspace', workspaceId: 1, name: '' }])('rejects malformed import target %j', (target) => {
    // Act
    const importValid = ipcSchema['opml:import'].guard({ target });
    const installValid = ipcSchema['feedpacks:install'].guard({ slug: 'tech', target });

    // Assert
    expect(importValid || installValid).toBe(false);
  });

  test('accepts source metadata only on a new OPML workspace', () => {
    // Arrange
    const target = { kind: 'new-workspace', name: '', icon: '', color: '', sourceSlug: 'tech', sourceVersion: '1' };

    // Act
    const importValid = ipcSchema['opml:import'].guard({ target });
    const installValid = ipcSchema['feedpacks:install'].guard({ slug: 'tech', target });

    // Assert
    expect(importValid).toBe(true);
    expect(installValid).toBe(false);
  });
});

describe('payload object shape', () => {
  test('accepts an object without a prototype', () => {
    // Arrange
    const arg = Object.assign(Object.create(null) as object, { workspaceId: 1 });

    // Act & Assert
    expect(ipcSchema['feeds:list'].guard(arg)).toBe(true);
  });
});

describe('consent choice payload', () => {
  test.each(['granted', 'denied'])('accepts %s', (arg) => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'usageAnalytics', value: arg })).toBe(true);
  });

  test.each(['', 'GRANTED', 'yes', true, undefined, null])('rejects %j', (arg) => {
    // Act & Assert
    expect(ipcSchema['settings:set'].guard({ key: 'usageAnalytics', value: arg })).toBe(false);
  });
});

describe('usage preferences', () => {
  const preferences = {
    density: 'Cards', theme: 'light', hideReadItems: false, markReadOnScroll: true, openLinksExternally: false, keyboardNavigation: true,
  };

  test.each(['Cards', 'Magazine', 'Compact'])('accepts the density %s', (density) => {
    // Act & Assert
    expect(isUsagePreferences({ ...preferences, density })).toBe(true);
  });

  test.each(['light', 'dark', 'system'])('accepts the theme %s', (theme) => {
    // Act & Assert
    expect(isUsagePreferences({ ...preferences, theme })).toBe(true);
  });

  test.each([
    ['density', ''],
    ['density', 'cards'],
    ['density', 'Comfortable'],
    ['theme', ''],
    ['theme', 'Light'],
    ['theme', 'auto'],
    ['hideReadItems', 'false'],
    ['markReadOnScroll', 1],
    ['openLinksExternally', null],
    ['keyboardNavigation', undefined],
  ])('rejects %s set to %j', (field, value) => {
    // Act & Assert
    expect(isUsagePreferences({ ...preferences, [field]: value })).toBe(false);
  });

  test('rejects extra fields and non-objects', () => {
    // Act & Assert
    expect(isUsagePreferences({ ...preferences, extra: true })).toBe(false);
    expect(isUsagePreferences(null)).toBe(false);
    expect(isUsagePreferences('Cards')).toBe(false);
  });
});

describe('import target kinds', () => {
  test.each([
    { kind: 'other', workspaceId: 1 },
    { kind: 'new-workspace', workspaceId: 1 },
    { kind: 'other', name: '', icon: '', color: '' },
    { kind: 'merge-workspace', name: '', icon: '', color: '' },
  ])('rejects the target %j', (target) => {
    // Act & Assert
    expect(ipcSchema['opml:import'].guard({ target })).toBe(false);
    expect(ipcSchema['feedpacks:install'].guard({ slug: 'tech', target })).toBe(false);
  });
});

describe('saved search payloads', () => {
  test('accepts well-formed requests', () => {
    // Act / Assert
    expect(ipcSchema['searches:create'].guard({ workspaceId: 1, name: 'a', query: 'b' })).toBe(true);
    expect(ipcSchema['searches:update'].guard({ searchId: 1, name: 'a' })).toBe(true);
    expect(ipcSchema['searches:update'].guard({ searchId: 1 })).toBe(true);
    expect(ipcSchema['searches:delete'].guard({ searchId: 1 })).toBe(true);
    expect(ipcSchema['searches:list'].guard({ workspaceId: 1 })).toBe(true);
    expect(ipcSchema['searches:dismiss-hint'].guard({ workspaceId: 1 })).toBe(true);
  });

  test('rejects malformed requests', () => {
    // Act / Assert
    expect(ipcSchema['searches:create'].guard({ workspaceId: 1, name: 'a' })).toBe(false);
    expect(ipcSchema['searches:update'].guard({ searchId: 0 })).toBe(false);
    expect(ipcSchema['searches:delete'].guard({ searchId: 1, extra: true })).toBe(false);
  });
});

describe('reveal and menu payloads', () => {
  test.each(['database', 'log', 'database-backup'])('accepts the reveal target %s', (target) => {
    // Act & Assert
    expect(isRevealTarget(target)).toBe(true);
  });

  test.each(['', 'logs', undefined, null, 1])('rejects the reveal target %j', (target) => {
    // Act & Assert
    expect(isRevealTarget(target)).toBe(false);
  });

  test.each(['feed', 'category', 'workspace'])('accepts a %s menu target', (kind) => {
    // Act & Assert
    expect(isMenuTarget({ kind, id: 1 })).toBe(true);
  });

  test.each([{ kind: 'feed', id: 0 }, { kind: 'feed', id: 1.5 }, { kind: 'item', id: 1 }, { kind: 'feed' }, { id: 1 }, 7, null])('rejects the menu target %j', (target) => {
    // Act & Assert
    expect(isMenuTarget(target)).toBe(false);
  });
});
