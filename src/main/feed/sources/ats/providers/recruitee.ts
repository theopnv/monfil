// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { intervalFromProvider, salaryFromRange, salaryFromText } from '../salary';
import type { AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, isoFromText, joinParts, num, parseJson, str } from '../values';
import { detectWorkMode } from '../workMode';

const NOT_BOARDS = new Set(['www', 'api', 'app', 'support', 'status']);
const SUFFIX = '.recruitee.com';

function modeOf(job: Record<string, unknown>): string | undefined {
  if (job['remote'] === true) {
    return 'remote';
  }
  if (job['hybrid'] === true) {
    return 'hybrid';
  }
  return job['on_site'] === true ? 'on-site' : undefined;
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['id']);
  const title = str(job['title']);
  if (!id || !title) {
    return null;
  }
  const location = str(job['location']) ?? joinParts([str(job['city']), str(job['country'])]);
  const requirements = str(job['requirements']);
  const html = `${str(job['description']) ?? ''}${requirements ? `<h3>Requirements</h3>${requirements}` : ''}`;
  const pay = asRec(job['salary']);
  return {
    id,
    title,
    url: str(job['careers_url']),
    html,
    publishedAt: isoFromText(job['published_at']) || isoFromText(job['created_at']),
    location,
    workMode: detectWorkMode(modeOf(job), location, title),
    salaryLabel: salaryFromRange(num(pay['min']), num(pay['max']), str(pay['currency']), intervalFromProvider(str(pay['period']))) ?? salaryFromText(html),
    department: str(job['department']),
    employmentType: str(job['employment_type_code']),
  };
}

export const recruitee: AtsProviderAdapter = {
  provider: 'recruitee',
  toBoard(url) {
    const host = url.hostname.toLowerCase();
    const slug = host.endsWith(SUFFIX) ? host.slice(0, -SUFFIX.length) : '';
    if (!slug || slug.includes('.') || NOT_BOARDS.has(slug)) {
      return null;
    }
    return { provider: 'recruitee', slug, apiUrl: `https://${slug}${SUFFIX}/api/offers/` };
  },
  normalize(body): AtsListing | null {
    const offers = asRec(parseJson(body))['offers'];
    if (!Array.isArray(offers)) {
      return null;
    }
    return { company: str(asRec(offers[0])['company_name']), jobs: asArray(offers).flatMap((raw) => toJob(raw) ?? []) };
  },
};
