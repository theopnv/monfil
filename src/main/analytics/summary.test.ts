// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { buildDailySummary, feedsBucket } from './summary';
import { USAGE_COUNTERS, type UsagePreferences } from '../../shared/contracts';

const preferences: UsagePreferences = {
  density: 'Magazine', theme: 'dark', hideReadItems: true, markReadOnScroll: false, openLinksExternally: false, keyboardNavigation: true,
};
const library = { feeds: 7, workspaces: 2, categories: 4, feedKinds: ['rss', 'youtube'] };

describe('feedsBucket', () => {
  test.each([
    [0, '0'], [1, '1-5'], [5, '1-5'], [6, '6-20'], [20, '6-20'], [21, '21-100'], [100, '21-100'], [101, '100+'], [5000, '100+'],
  ])('puts %i feeds in %s', (feeds, bucket) => {
    // Act, Assert
    expect(feedsBucket(feeds)).toBe(bucket);
  });
});

describe('buildDailySummary', () => {
  test('sends every counter, with zero for the ones that have no tally', () => {
    // Act
    const props = buildDailySummary({ day: '2026-10-22', counters: { articles_opened: 4 }, library, preferences });

    // Assert
    expect(props['day']).toBe('2026-10-22');
    expect(props['articles_opened']).toBe(4);
    for (const name of USAGE_COUNTERS.filter((counter) => counter !== 'articles_opened')) {
      expect(props[name]).toBe(0);
    }
  });

  test('buckets the library and lists the kinds of feed', () => {
    // Act
    const props = buildDailySummary({ day: '2026-10-22', counters: {}, library, preferences });

    // Assert
    expect(props).toMatchObject({ feeds_bucket: '6-20', workspaces_count: 2, categories_count: 4, feed_kinds: 'rss+youtube' });
    expect(props).not.toHaveProperty('feeds');
  });

  test('reports an empty library', () => {
    // Act
    const props = buildDailySummary({ day: '2026-10-22', counters: {}, library: { feeds: 0, workspaces: 1, categories: 0, feedKinds: [] }, preferences });

    // Assert
    expect(props).toMatchObject({ feeds_bucket: '0', feed_kinds: 'none' });
  });

  test('states the preferences as text', () => {
    // Act
    const props = buildDailySummary({ day: '2026-10-22', counters: {}, library, preferences });

    // Assert
    expect(props).toMatchObject({
      pref_density: 'Magazine', pref_theme: 'dark', pref_hide_read_items: 'true', pref_mark_read_on_scroll: 'false',
      pref_open_links_externally: 'false', pref_keyboard_navigation: 'true',
    });
  });

  test('marks the preferences unknown before the renderer reported them', () => {
    // Act
    const props = buildDailySummary({ day: '2026-10-22', counters: {}, library, preferences: undefined });

    // Assert
    expect(props).toMatchObject({
      pref_density: 'unknown', pref_theme: 'unknown', pref_hide_read_items: 'unknown', pref_mark_read_on_scroll: 'unknown',
      pref_open_links_externally: 'unknown', pref_keyboard_navigation: 'unknown',
    });
  });

  test('stays inside the limits of the server', () => {
    // Act
    const props = buildDailySummary({
      day: '2026-10-22', counters: {}, preferences,
      library: { ...library, feedKinds: Array.from({ length: 40 }, () => 'conference') },
    });

    // Assert
    for (const [key, value] of Object.entries(props)) {
      expect(key.length).toBeLessThanOrEqual(40);
      if (typeof value === 'string') {
        expect(value.length).toBeLessThanOrEqual(180);
      }
    }
    expect(String(props['feed_kinds'])).toHaveLength(180);
  });
});
