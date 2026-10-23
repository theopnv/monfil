// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { salaryFromText } from '../salary';
import type { AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, firstSegment, isoFromText, joinParts, parseJson, str } from '../values';
import { detectWorkMode } from '../workMode';

function slugOf(url: URL): string | undefined {
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'www.workable.com') {
    return segments[0] === 'api' && segments[1] === 'accounts' ? segments[2] : undefined;
  }
  if (segments[0] === 'api') {
    return segments[1] === 'v1' && segments[2] === 'widget' && segments[3] === 'accounts' ? segments[4] : undefined;
  }
  const first = firstSegment(url);
  return first === 'j' ? undefined : first;
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['shortcode']);
  const title = str(job['title']);
  if (!id || !title) {
    return null;
  }
  const location = joinParts([str(job['city']), str(job['state']), str(job['country'])]);
  const html = str(job['description']) ?? '';
  return {
    id,
    title,
    url: str(job['url']) ?? str(job['shortlink']),
    html,
    publishedAt: isoFromText(job['published_on']) || isoFromText(job['created_at']),
    location,
    workMode: detectWorkMode(job['telecommuting'] === true ? 'remote' : undefined, location, title),
    salaryLabel: salaryFromText(html),
    department: str(job['department']),
    employmentType: str(job['employment_type']),
  };
}

export const workable: AtsProviderAdapter = {
  provider: 'workable',
  toBoard(url) {
    const host = url.hostname.toLowerCase();
    if (host !== 'apply.workable.com' && host !== 'www.workable.com') {
      return null;
    }
    const slug = slugOf(url);
    return slug ? { provider: 'workable', slug, apiUrl: `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true` } : null;
  },
  normalize(body): AtsListing | null {
    const root = asRec(parseJson(body));
    const jobs = asArray(root['jobs']);
    if (!Array.isArray(root['jobs']) || (jobs.length > 0 && !('shortcode' in asRec(jobs[0])))) {
      return null;
    }
    return { company: str(root['name']), jobs: jobs.flatMap((raw) => toJob(raw) ?? []) };
  },
};
