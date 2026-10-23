// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decodeText } from '../../text';
import { salaryFromText } from '../salary';
import type { AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { joinParts } from '../values';
import { detectWorkMode } from '../workMode';
import { blocks, textOf } from '../xml';

const NOT_BOARDS = new Set(['www', 'app', 'support', 'api']);
const SUFFIX = '.teamtailor.com';

function locationOf(item: string): string | undefined {
  const places = blocks(item, 'tt:location').map((place) => joinParts([textOf(place, 'tt:city') ?? textOf(place, 'tt:name'), textOf(place, 'tt:country')]));
  return joinParts(places);
}

function toJob(item: string): AtsJob | null {
  const title = textOf(item, 'title');
  const id = textOf(item, 'guid') ?? textOf(item, 'link');
  if (!title || !id) {
    return null;
  }
  const location = locationOf(item);
  const html = decodeText(textOf(item, 'description') ?? '');
  const published = Date.parse(textOf(item, 'pubDate') ?? '');
  return {
    id,
    title,
    url: textOf(item, 'link'),
    html,
    publishedAt: Number.isNaN(published) ? '' : new Date(published).toISOString(),
    location,
    workMode: detectWorkMode(textOf(item, 'remoteStatus'), location, title),
    salaryLabel: salaryFromText(html),
    department: textOf(item, 'tt:department'),
    employmentType: undefined,
  };
}

export const teamtailor: AtsProviderAdapter = {
  provider: 'teamtailor',
  toBoard(url) {
    const host = url.hostname.toLowerCase();
    const slug = host.endsWith(SUFFIX) ? host.slice(0, -SUFFIX.length) : '';
    if (!slug || slug.includes('.') || NOT_BOARDS.has(slug)) {
      return null;
    }
    return { provider: 'teamtailor', slug, apiUrl: `https://${slug}${SUFFIX}/jobs.rss` };
  },
  normalize(body): AtsListing | null {
    if (!body.includes('xmlns:tt=') || !body.includes('<rss')) {
      return null;
    }
    const channel = body.slice(0, body.indexOf('<item>') === -1 ? undefined : body.indexOf('<item>'));
    return { company: textOf(channel, 'title'), jobs: blocks(body, 'item').flatMap((item) => toJob(item) ?? []) };
  },
};
