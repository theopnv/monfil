// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { invokePayloadGuards } from './ipc-payloads';
import type { NewFeedInput, SourceItem } from './contracts';
import type { TwoWayRendererMainChannels } from './channels';

const item: SourceItem = {
  title: 'Item', guid: 'item', link: undefined, pubDate: 'invalid-date', description: '',
  image: undefined, author: undefined, extra: undefined, read_at: undefined,
};
const feed: NewFeedInput = {
  link: 'https://example.com/feed', title: 'Feed', type: 'rss', items: [item],
  categoryName: '', workspaceId: 1, showInWorkspace: true,
};

describe('IPC payload guards', () => {
  test.each([
    { workspaceId: 1, itemId: 0, saved: true },
    { workspaceId: 1, itemId: 1, saved: 'true' },
    { workspaceId: 0, itemId: 1, saved: true },
    { workspaceId: 1, itemId: 1, saved: true, extra: true },
  ])('rejects malformed saved state %j', (arg) => {
    // Act
    const valid = invokePayloadGuards['items:set-saved'](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each([
    { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0 } },
    { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0, savedAt: NaN } },
    { workspaceId: 1, limit: 50, feedIds: [1] },
  ])('rejects malformed Saved query %j', (arg) => {
    // Act
    const valid = invokePayloadGuards['saved:query'](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts a Saved cursor and saved state', () => {
    // Act
    const queryValid = invokePayloadGuards['saved:query']({ workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: 0, savedAt: 10 } });
    const stateValid = invokePayloadGuards['items:set-saved']({ workspaceId: 1, itemId: 1, saved: false });

    // Assert
    expect(queryValid && stateValid).toBe(true);
  });
  test.each([{}, [], new Date(), new Map(), { workspaceId: 1, extra: true }, { workspaceId: 1, constructor: '' }, { workspaceId: 1, [Symbol('extra')]: true }, Object.create({ workspaceId: 1 }) as unknown])('rejects malformed workspace object %j', (arg) => {
    // Act
    const valid = invokePayloadGuards['feeds:list'](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each(Object.keys(item))('rejects a wrong type for feed item field %s', (field) => {
    // Arrange
    const arg = { ...feed, items: [{ ...item, [field]: 42 }] };

    // Act
    const valid = invokePayloadGuards['feeds:submit-add-feed'](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each(['title', 'guid', 'pubDate', 'description'])('requires feed item field %s', (field) => {
    // Arrange
    const partial = Object.fromEntries(Object.entries(item).filter(([key]) => key !== field));

    // Act
    const valid = invokePayloadGuards['feeds:submit-add-feed']({ ...feed, items: [partial] });

    // Assert
    expect(valid).toBe(false);
  });

  test.each([null, {}, [null], new Array<unknown>(1), [{ ...item, extraField: true }]].map((items) => ({ items })))('rejects malformed item collection %j', ({ items }) => {
    // Act
    const valid = invokePayloadGuards['feeds:submit-add-feed']({ ...feed, items });

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts missing feed dates and optional metadata as strings or undefined', () => {
    // Arrange
    const arg = { ...feed, type: 'youtube', icon: undefined, items: [{ ...item, pubDate: '', extra: '{}' }] };

    // Act
    const valid = invokePayloadGuards['feeds:submit-add-feed'](structuredClone(arg));

    // Assert
    expect(valid).toBe(true);
  });

  test.each([[], [0], [NaN], [1.5], ['1'], new Array<unknown>(1)].map((itemIds) => ({ itemIds })))('checks IDs inside arrays %j', ({ itemIds }) => {
    // Act
    const valid = invokePayloadGuards['items:set-read']({ itemIds, read: false });

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
    const valid = invokePayloadGuards['items:query'](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test('accepts optional query fields and timestamps before the Unix epoch', () => {
    // Arrange
    const arg = { workspaceId: 1, limit: 50, cursor: { id: 1, publishedAt: -1 }, feedIds: [], ids: undefined, search: undefined, unreadOnly: false };

    // Act
    const valid = invokePayloadGuards['items:query'](structuredClone(arg));

    // Assert
    expect(valid).toBe(true);
  });

  test.each([15, 30, 60, 360, 'manual'])('accepts refresh interval %s', (arg) => {
    // Act
    const valid = invokePayloadGuards['settings:set-refresh-interval'](arg);

    // Assert
    expect(valid).toBe(true);
  });

  test.each([15, 30, 60, 90, 180])('accepts retention period %s', (arg) => {
    // Act
    const valid = invokePayloadGuards['settings:set-retention-days'](arg);

    // Assert
    expect(valid).toBe(true);
  });

  test.each([
    ['settings:set-refresh-interval', '30'], ['settings:set-refresh-interval', 90],
    ['settings:set-retention-days', '30'], ['settings:set-retention-days', 360],
    ['settings:set-detailed-logging', 1], ['settings:set-refresh-on-launch', 'false'],
    ['feeds:validate-feed-url', { query: 'https://example.com', type: 'json' }],
    ['workspaces:update', { workspaceId: 1, icon: 42 }],
    ['feeds:submit-add-feed', { ...feed, showInWorkspace: 1 }],
  ] satisfies [TwoWayRendererMainChannels, unknown][])('rejects a wrong value on %s', (channel, arg) => {
    // Act
    const valid = invokePayloadGuards[channel](arg);

    // Assert
    expect(valid).toBe(false);
  });

  test.each([
    { kind: 'merge-workspace', workspaceId: 1 },
    { kind: 'new-workspace', name: '', icon: '', color: '' },
  ])('accepts import and feedpack target %j', (target) => {
    // Act
    const importValid = invokePayloadGuards['opml:import']({ target });
    const installValid = invokePayloadGuards['feedpacks:install']({ slug: 'tech', target });

    // Assert
    expect(importValid && installValid).toBe(true);
  });

  test.each([{}, { kind: 'other' }, { kind: 'merge-workspace', workspaceId: 0 }, { kind: 'new-workspace', name: '', icon: '' }, { kind: 'merge-workspace', workspaceId: 1, name: '' }])('rejects malformed import target %j', (target) => {
    // Act
    const importValid = invokePayloadGuards['opml:import']({ target });
    const installValid = invokePayloadGuards['feedpacks:install']({ slug: 'tech', target });

    // Assert
    expect(importValid || installValid).toBe(false);
  });

  test('accepts source metadata only on a new OPML workspace', () => {
    // Arrange
    const target = { kind: 'new-workspace', name: '', icon: '', color: '', sourceSlug: 'tech', sourceVersion: '1' };

    // Act
    const importValid = invokePayloadGuards['opml:import']({ target });
    const installValid = invokePayloadGuards['feedpacks:install']({ slug: 'tech', target });

    // Assert
    expect(importValid).toBe(true);
    expect(installValid).toBe(false);
  });
});
