// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decodeText } from '../../text';
import { salaryFromRange, salaryFromText } from '../salary';
import type { AtsBoard, AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, firstSegment, isoFromText, num, parseJson, str } from '../values';
import { detectWorkMode } from '../workMode';

const HOSTS = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards-api.greenhouse.io']);

function board(slug: string): AtsBoard {
  return { provider: 'greenhouse', slug, apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true` };
}

function slugOf(url: URL): string | undefined {
  const embedded = url.searchParams.get('for');
  if (embedded) {
    return embedded;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'boards-api.greenhouse.io') {
    return segments[0] === 'v1' && segments[1] === 'boards' ? segments[2] : undefined;
  }
  const first = firstSegment(url);
  return first === 'embed' ? undefined : first;
}

function payLabel(raw: unknown): string | undefined {
  const range = asRec(asArray(raw)[0]);
  const scale = 100;
  const min = num(range['min_cents']);
  const max = num(range['max_cents']);
  return salaryFromRange(min === undefined ? undefined : min / scale, max === undefined ? undefined : max / scale, str(range['currency_type']), 'year');
}

function employmentType(metadata: unknown): string | undefined {
  for (const entry of asArray(metadata)) {
    const record = asRec(entry);
    if (/employment|time type|contract/i.test(str(record['name']) ?? '')) {
      return str(record['value']);
    }
  }
  return undefined;
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['id']);
  const title = str(job['title']);
  if (!id || !title) {
    return null;
  }
  const location = str(asRec(job['location'])['name']);
  const html = decodeText(str(job['content']) ?? '');
  return {
    id,
    title,
    url: str(job['absolute_url']),
    html,
    publishedAt: isoFromText(job['first_published']),
    location,
    workMode: detectWorkMode(undefined, location, title),
    salaryLabel: payLabel(job['pay_input_ranges']) ?? salaryFromText(html),
    department: str(asRec(asArray(job['departments'])[0])['name']),
    employmentType: employmentType(job['metadata']),
  };
}

export const greenhouse: AtsProviderAdapter = {
  provider: 'greenhouse',
  toBoard(url) {
    if (!HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    const slug = slugOf(url);
    return slug ? board(slug) : null;
  },
  normalize(body): AtsListing | null {
    const root = asRec(parseJson(body));
    const jobs = root['jobs'];
    if (!Array.isArray(jobs) || (jobs.length > 0 && !('absolute_url' in asRec(jobs[0])))) {
      return null;
    }
    const listing = jobs.flatMap((raw: unknown) => toJob(raw) ?? []);
    return { company: str(asRec(jobs[0])['company_name']), jobs: listing };
  },
};
