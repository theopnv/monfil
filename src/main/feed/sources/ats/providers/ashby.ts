// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { intervalFromProvider, salaryFromRange, salaryFromText } from '../salary';
import type { AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, firstSegment, isoFromText, num, parseJson, pathSegments, str } from '../values';
import { detectWorkMode } from '../workMode';

function slugOf(url: URL): string | undefined {
  const segments = pathSegments(url);
  return url.hostname === 'api.ashbyhq.com' ? (segments[0] === 'posting-api' && segments[1] === 'job-board' ? segments[2] : undefined) : firstSegment(url);
}

function salaryOf(compensation: unknown, html: string): string | undefined {
  const components = asArray(asRec(compensation)['summaryComponents']).map(asRec);
  const salary = components.find((component) => str(component['compensationType'])?.toLowerCase() === 'salary');
  const structured = salary
    ? salaryFromRange(num(salary['minValue']), num(salary['maxValue']), str(salary['currencyCode']), intervalFromProvider(str(salary['interval'])))
    : undefined;
  return structured ?? salaryFromText(str(asRec(compensation)['scrapeableCompensationSalarySummary']) ?? '') ?? salaryFromText(html);
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['id']);
  const title = str(job['title']);
  if (!id || !title) {
    return null;
  }
  const location = str(job['location']);
  const html = str(job['descriptionHtml']) ?? '';
  const mode = str(job['workplaceType']) ?? (job['isRemote'] === true ? 'remote' : undefined);
  return {
    id,
    title,
    url: str(job['jobUrl']),
    html,
    publishedAt: isoFromText(job['publishedAt']),
    location,
    workMode: detectWorkMode(mode, location, title),
    salaryLabel: salaryOf(job['compensation'], html),
    department: str(job['department']) ?? str(job['team']),
    employmentType: str(job['employmentType']),
  };
}

export const ashby: AtsProviderAdapter = {
  provider: 'ashby',
  toBoard(url) {
    const host = url.hostname.toLowerCase();
    if (host !== 'jobs.ashbyhq.com' && host !== 'api.ashbyhq.com') {
      return null;
    }
    const slug = slugOf(url);
    return slug ? { provider: 'ashby', slug, apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true` } : null;
  },
  normalize(body): AtsListing | null {
    const jobs = asRec(parseJson(body))['jobs'];
    if (!Array.isArray(jobs) || (jobs.length > 0 && !('jobUrl' in asRec(jobs[0])))) {
      return null;
    }
    return { company: undefined, jobs: jobs.flatMap((raw: unknown) => toJob(raw) ?? []) };
  },
};
