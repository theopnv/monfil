// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { arxivCandidates, arxivSource, isArxivLink } from './arxiv';

const item = (id: string, type: string) => `
  <item>
    <title>Paper ${id}</title>
    <link>https://arxiv.org/abs/${id}</link>
    <description>arXiv:${id}v1 Announce Type: ${type}
Abstract: Something about ${id}.</description>
    <guid isPermaLink="false">oai:arXiv.org:${id}v1</guid>
    <pubDate>Sat, 17 Oct 2026 00:00:00 -0400</pubDate>
    <arxiv:announce_type>${type}</arxiv:announce_type>
  </item>`;

const FEED = `<?xml version='1.0' encoding='UTF-8'?>
<rss xmlns:arxiv="http://arxiv.org/schemas/atom" version="2.0">
  <channel>
    <title>cs.AI updates on arXiv.org</title>
    <description>cs.AI updates on the arXiv.org e-print archive.</description>
    ${item('2610.00001', 'new')}
    ${item('2610.00002', 'cross')}
    ${item('2610.00003', 'replace')}
    ${item('2610.00004', 'replace-cross')}
  </channel>
</rss>`;

describe('arxivCandidates', () => {
  test('a listing URL maps to its category feed', () => {
    // Act / Assert
    expect(arxivCandidates('https://arxiv.org/list/cs.AI/recent')).toEqual([{ link: 'https://rss.arxiv.org/rss/cs.AI', label: 'cs.AI' }]);
    expect(arxivCandidates('arxiv.org/list/cs.LG/new')).toEqual([{ link: 'https://rss.arxiv.org/rss/cs.LG', label: 'cs.LG' }]);
  });

  test('a category feed URL is kept as it is', () => {
    // Act / Assert
    expect(arxivCandidates('https://rss.arxiv.org/rss/cs.CL')).toEqual([{ link: 'https://rss.arxiv.org/rss/cs.CL' }]);
  });

  test('a paper URL is rejected', () => {
    // Act / Assert
    expect(arxivCandidates('https://arxiv.org/abs/2610.20665')).toBeNull();
  });
});

describe('isArxivLink', () => {
  test('detects listing and feed URLs', () => {
    // Act / Assert
    expect(isArxivLink('https://arxiv.org/list/cs.AI/recent')).toBe(true);
    expect(isArxivLink('https://rss.arxiv.org/rss/cs.AI')).toBe(true);
    expect(isArxivLink('https://arxiv.org/abs/2610.20665')).toBe(false);
  });
});

describe('arxivSource.parse', () => {
  test('keeps new papers and cross-lists and drops replacements', () => {
    // Act
    const parsed = arxivSource.parse(FEED);

    // Assert
    expect(parsed?.items.map((entry) => entry.title)).toEqual(['Paper 2610.00001', 'Paper 2610.00002']);
  });
});
