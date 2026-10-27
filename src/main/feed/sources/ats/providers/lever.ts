// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { salaryFromRange, salaryFromText, intervalFromProvider } from '../salary';
import type { AtsBoard, AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, firstSegment, isoFromMs, joinParts, num, parseJson, pathSegments, str } from '../values';
import { detectWorkMode } from '../workMode';
import { escapeText } from '../../text';

const HOSTS: Record<string, string> = {
  'jobs.lever.co': 'api.lever.co',
  'api.lever.co': 'api.lever.co',
  'jobs.eu.lever.co': 'api.eu.lever.co',
  'api.eu.lever.co': 'api.eu.lever.co',
};

function slugOf(url: URL): string | undefined {
  const segments = pathSegments(url);
  return url.hostname.startsWith('api.') ? (segments[0] === 'v0' && segments[1] === 'postings' ? segments[2] : undefined) : firstSegment(url);
}

function descriptionHtml(job: Record<string, unknown>): string {
  const lists = asArray(job['lists']).map((entry) => {
    const list = asRec(entry);
    return `<h3>${escapeText(str(list['text']) ?? '')}</h3><ul>${str(list['content']) ?? ''}</ul>`;
  });
  return [str(job['description']) ?? '', ...lists, str(job['additional']) ?? ''].join('');
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['id']);
  const title = str(job['text']);
  if (!id || !title) {
    return null;
  }
  const categories = asRec(job['categories']);
  const location = joinParts([str(categories['location'])]) ?? joinParts(asArray(categories['allLocations']).map(str));
  const html = descriptionHtml(job);
  const range = asRec(job['salaryRange']);
  return {
    id,
    title,
    url: str(job['hostedUrl']),
    html,
    publishedAt: isoFromMs(job['createdAt']),
    location,
    workMode: detectWorkMode(str(job['workplaceType']), location, title),
    salaryLabel: salaryFromRange(num(range['min']), num(range['max']), str(range['currency']), intervalFromProvider(str(range['interval']))) ?? salaryFromText(str(job['salaryDescriptionPlain']) ?? html),
    department: str(categories['department']) ?? str(categories['team']),
    employmentType: str(categories['commitment']),
  };
}

export const lever: AtsProviderAdapter = {
  provider: 'lever',
  toBoard(url) {
    const apiHost = HOSTS[url.hostname.toLowerCase()];
    const slug = apiHost ? slugOf(url) : undefined;
    if (!apiHost || !slug) {
      return null;
    }
    const board: AtsBoard = { provider: 'lever', slug, apiUrl: `https://${apiHost}/v0/postings/${encodeURIComponent(slug)}?mode=json` };
    return board;
  },
  normalize(body): AtsListing | null {
    const root = parseJson(body);
    if (!Array.isArray(root) || (root.length > 0 && !('hostedUrl' in asRec(root[0])))) {
      return null;
    }
    return { company: undefined, jobs: root.flatMap((raw: unknown) => toJob(raw) ?? []) };
  },
};
