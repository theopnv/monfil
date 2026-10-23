// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { escapeText } from '../../text';
import type { AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { asArray, asRec, firstSegment, isoFromText, joinParts, parseJson, str } from '../values';
import { detectWorkMode } from '../workMode';

const PAGE_SIZE = 100;
// Filters of the public postings API that narrow a large employer's board to the postings a user wants.
const KEPT_PARAMS = ['country', 'region', 'city', 'department', 'q'];

function slugOf(url: URL): string | undefined {
  const segments = url.pathname.split('/').filter(Boolean);
  return url.hostname === 'api.smartrecruiters.com' ? (segments[0] === 'v1' && segments[1] === 'companies' ? segments[2] : undefined) : firstSegment(url);
}

function modeOf(location: Record<string, unknown>): string | undefined {
  if (location['remote'] === true) {
    return 'remote';
  }
  return location['hybrid'] === true ? 'hybrid' : undefined;
}

// The list call carries no posting text, so the card shows the facts it has and the job page holds the rest.
function summaryHtml(facts: (string | undefined)[]): string {
  const present = facts.filter((fact): fact is string => fact !== undefined);
  return present.length > 0 ? `<p>${escapeText(present.join(' · '))}</p>` : '';
}

function toJob(raw: unknown): AtsJob | null {
  const job = asRec(raw);
  const id = str(job['id']);
  const title = str(job['name']);
  if (!id || !title) {
    return null;
  }
  const company = asRec(job['company']);
  const place = asRec(job['location']);
  const location = str(place['fullLocation']) ?? joinParts([str(place['city']), str(place['region']), str(place['country'])?.toUpperCase()]);
  const department = str(asRec(job['department'])['label']) ?? str(asRec(job['function'])['label']);
  const employmentType = str(asRec(job['typeOfEmployment'])['label']);
  const slug = str(company['identifier']);
  return {
    id,
    title,
    url: slug ? `https://jobs.smartrecruiters.com/${encodeURIComponent(slug)}/${encodeURIComponent(id)}` : undefined,
    html: summaryHtml([department, employmentType, location]),
    publishedAt: isoFromText(job['releasedDate']),
    location,
    workMode: detectWorkMode(modeOf(place), location, title),
    salaryLabel: undefined,
    department,
    employmentType,
  };
}

export const smartrecruiters: AtsProviderAdapter = {
  provider: 'smartrecruiters',
  toBoard(url) {
    const host = url.hostname.toLowerCase();
    if (host !== 'jobs.smartrecruiters.com' && host !== 'careers.smartrecruiters.com' && host !== 'api.smartrecruiters.com') {
      return null;
    }
    const slug = slugOf(url);
    if (!slug) {
      return null;
    }
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    for (const key of KEPT_PARAMS) {
      const value = url.searchParams.get(key);
      if (value && url.hostname === 'api.smartrecruiters.com') {
        params.set(key, value);
      }
    }
    return { provider: 'smartrecruiters', slug, apiUrl: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?${params.toString()}` };
  },
  normalize(body): AtsListing | null {
    const content = asRec(parseJson(body))['content'];
    if (!Array.isArray(content) || (content.length > 0 && !('uuid' in asRec(content[0])))) {
      return null;
    }
    return { company: str(asRec(asRec(content[0])['company'])['name']), jobs: asArray(content).flatMap((raw) => toJob(raw) ?? []) };
  },
};
