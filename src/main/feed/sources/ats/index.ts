// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../../../lib/fetch';
import type { FeedFetchError, ParsedSource } from '../../../../shared/contracts';
import type { Result } from '../../../../shared/result';
import { fetchAndParse, MAX_CANDIDATES, unsupported, toUrl } from '../feedSource';
import { resolveSiteIcon } from '../siteIcon';
import type { NewSourceItem, ParsedFeedContent, SourceAdapter, SourceFetchInput, SourceFetchResult } from '../types';
import { PROVIDERS, toBoard } from './providers';
import type { AtsBoard, AtsJob, AtsListing } from './types';

const ATS_DOMAINS = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 'recruitee.com', 'teamtailor.com', 'personio.com', 'personio.de'];
const LINK_IN_PAGE = /https?:\/\/[^\s"'<>\\)]+/g;
const NOT_FOUND = 'No job board was found. Paste a job board link from Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Teamtailor or Personio, or a careers page that links to one.';

function titleCase(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function companyName(listing: AtsListing, board: AtsBoard): string {
  return listing.company ?? titleCase(board.slug);
}

/** One river card for a job. The date stays empty when the ATS has no stable one, so the first-seen time applies. */
export function toItem(job: AtsJob, board: Pick<AtsBoard, 'provider'>, company: string): NewSourceItem {
  return {
    title: job.title,
    guid: `${board.provider}:${job.id}`,
    link: job.url,
    pubDate: job.publishedAt,
    description: job.html,
    image: undefined,
    author: company,
    extra: JSON.stringify({
      provider: board.provider,
      company,
      location: job.location,
      workMode: job.workMode,
      salaryLabel: job.salaryLabel,
      department: job.department,
      employmentType: job.employmentType,
    }),
    read_at: undefined,
  };
}

function companySite(listing: AtsListing): string | undefined {
  const link = listing.jobs.find((job) => job.url)?.url;
  const url = link ? toUrl(link) : null;
  if (!url || ATS_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    return undefined;
  }
  return url.origin;
}

function toContent(listing: AtsListing, board: AtsBoard): ParsedFeedContent {
  const company = companyName(listing, board);
  return {
    title: `${company} · Jobs`,
    description: `Open positions at ${company}.`,
    siteLink: companySite(listing),
    items: listing.jobs.map((job) => toItem(job, board, company)),
  };
}

function parseListing(content: string, board: AtsBoard | undefined): { listing: AtsListing; board: AtsBoard } | null {
  const providers = board ? PROVIDERS.filter((adapter) => adapter.provider === board.provider) : PROVIDERS;
  for (const adapter of providers) {
    const listing = adapter.normalize(content, board);
    if (listing) {
      return { listing, board: board ?? { provider: adapter.provider, slug: '', apiUrl: '' } };
    }
  }
  return null;
}

function parseFor(board: AtsBoard | undefined) {
  return (content: string): ParsedFeedContent | null => {
    const parsed = parseListing(content, board);
    return parsed ? toContent(parsed.listing, parsed.board) : null;
  };
}

async function fetchBoard(board: AtsBoard, validators: SourceFetchInput['validators'], blockPrivateHosts: boolean) {
  return fetchAndParse(board.apiUrl, validators, parseFor(board), blockPrivateHosts);
}

async function discoverBoard(board: AtsBoard, blockPrivateHosts: boolean): Promise<Result<ParsedSource, FeedFetchError>> {
  const fetched = await fetchBoard(board, undefined, blockPrivateHosts);
  if (!fetched.success) {
    return fetched;
  }
  if ('notModified' in fetched.data) {
    return unsupported('The job board did not change since it was last fetched.');
  }
  const { parsed } = fetched.data;
  const icon = parsed.siteLink ? await resolveSiteIcon(parsed.siteLink).catch(() => undefined) : undefined;
  return {
    success: true,
    data: { type: 'ats', link: board.apiUrl, title: parsed.title, description: parsed.description, items: parsed.items, icon, ...(parsed.siteLink ? { siteLink: parsed.siteLink } : {}) },
  };
}

/** The ATS boards a careers page links to or embeds, in page order. */
export function boardsInPage(html: string): AtsBoard[] {
  const boards = new Map<string, AtsBoard>();
  for (const [link] of html.matchAll(LINK_IN_PAGE)) {
    const board = toBoard(link.replace(/&amp;/g, '&'));
    if (board && !boards.has(board.apiUrl)) {
      boards.set(board.apiUrl, board);
    }
  }
  return [...boards.values()];
}

async function discoverFromPage(query: string): Promise<Result<ParsedSource[], FeedFetchError>> {
  const url = toUrl(query);
  if (!url) {
    return unsupported(NOT_FOUND);
  }
  const page = await fetchText(url.href, { blockPrivateHosts: true });
  if (!page.success) {
    return unsupported(NOT_FOUND);
  }
  const boards = boardsInPage(page.data.body).slice(0, MAX_CANDIDATES);
  const results = await Promise.all(boards.map((board) => discoverBoard(board, true)));
  const found = results.flatMap((result) => (result.success ? [result.data] : []));
  return found.length > 0 ? { success: true, data: found } : unsupported(NOT_FOUND);
}

async function discover(query: string): Promise<Result<ParsedSource[], FeedFetchError>> {
  const board = toBoard(query);
  if (!board) {
    return discoverFromPage(query);
  }
  const result = await discoverBoard(board, false);
  return result.success ? { success: true, data: [result.data] } : result;
}

async function fetchJobs(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>> {
  const board = toBoard(input.link);
  if (!board) {
    return unsupported("This doesn't look like a supported job board.");
  }
  const fetched = await fetchBoard(board, input.validators, false);
  if (!fetched.success) {
    return fetched;
  }
  if ('notModified' in fetched.data) {
    return { success: true, data: fetched.data };
  }
  const { parsed, validators } = fetched.data;
  return {
    success: true,
    data: { validators, parsed: { type: 'ats', link: input.link, title: parsed.title, description: parsed.description, items: parsed.items, icon: undefined, siteLink: parsed.siteLink } },
  };
}

/** Whether `raw` is a job board page or API URL on a supported ATS, the signal host detection and OPML import use. */
export function isAtsLink(raw: string): boolean {
  return toBoard(raw) !== null;
}

export const atsSource: SourceAdapter = {
  type: 'ats',
  fetchesFullArticle: false,
  matches: isAtsLink,
  discover,
  fetch: fetchJobs,
  parse: parseFor(undefined),
};
