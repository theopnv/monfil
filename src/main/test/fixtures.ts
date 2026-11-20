// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { HOME_WORKSPACE_ID, type NewFeedInput, type SourceItem } from '../../shared/contracts';

export function makeFeedInput(overrides: Partial<NewFeedInput> = {}): NewFeedInput {
  return {
    link: 'https://a.example/feed',
    title: 'Feed A',
    type: 'rss',
    items: [],
    categoryName: 'tech',
    workspaceId: HOME_WORKSPACE_ID,
    showInWorkspace: true,
    ...overrides,
  };
}

/** An item as a source gives it. Without a guid, it falls back to the link, then to the title, like the parsers do. */
export function makeItem(overrides: Partial<SourceItem> = {}): SourceItem {
  const link = 'link' in overrides ? overrides.link : 'https://a.example/1';
  const title = overrides.title ?? 'Item';
  return {
    title,
    guid: link ?? `monfil:test:${title}`,
    link,
    pubDate: '2024-01-01',
    description: '',
    image: undefined,
    author: undefined,
    extra: undefined,
    read_at: undefined,
    ...overrides,
  };
}
