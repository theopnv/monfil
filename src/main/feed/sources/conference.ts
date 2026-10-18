// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchConditional, fetchText, type FetchedText, type FetchValidators } from '../../lib/fetch';
import type { FeedFetchError, ParsedSource } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import { mapFetchError, toUrl, unsupported } from './feedSource';
import { escapeText } from './text';
import type { NewSourceItem, ParsedFeedContent, SourceAdapter, SourceFetchInput, SourceFetchResult } from './types';

/** A conference in a shape that does not depend on the dataset it came from. */
export interface ConferenceEvent {
  name: string;
  /** UTC midnight of the first day, in ms. */
  start: number;
  /** The last millisecond of the last day, in UTC. */
  end: number;
  city: string;
  country: string;
  website: string | undefined;
  cfpLink: string | undefined;
  cfpCloses: number | undefined;
  tags: string[];
}

export interface ConferenceFilter {
  topics: string[];
  places: string[];
  /** Only links set it: the site's language filter, which every kept event must match on top of the topics. */
  languages?: string[];
}

export type Milestone = 'announced' | 'cfp-open' | 'cfp-closing' | 'soon' | 'today';

const HOSTS = new Set(['developers.events', 'www.developers.events']);
const DATASET_URL = 'https://developers.events/all-events.json';
const CREDIT_URL = 'https://developers.events/';
const DAY_MS = 24 * 60 * 60 * 1000;
const ANNOUNCE_WINDOW_MS = 365 * DAY_MS;
const CFP_CLOSING_WINDOW_MS = 14 * DAY_MS;
const SOON_WINDOW_MS = 30 * DAY_MS;
const DESCRIPTION = 'Conference milestones from developers.events (CC BY-NC 4.0).';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function splitList(text: string | null | undefined): string[] {
  return (text ?? '').split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

function capitalize(place: string): string {
  return place.replace(/(^|\s)(\p{Ll})/gu, (_match, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
}

function toFilter(topics: string[], places: string[], languages: string[] = []): ConferenceFilter {
  const filter = { topics: topics.map((topic) => topic.toLowerCase().replace(/\s+/g, '-')), places: places.map(capitalize) };
  return languages.length > 0 ? { ...filter, languages: languages.map((language) => language.toLowerCase()) } : filter;
}

// The site keeps its filters in a hash route such as `#/2026/list?country=Norway`; the year only picks the page's view.
const LINK_FILTERS = { topics: ['topics', 'topic', 'tech'], places: ['places', 'country'], languages: ['languages', 'language'] };
const KNOWN_PARAMS = new Set(Object.values(LINK_FILTERS).flat());

function linkParams(url: URL): URLSearchParams {
  const query = url.hash.indexOf('?');
  return query === -1 ? url.searchParams : new URLSearchParams(url.hash.slice(query + 1));
}

function siteUrl(raw: string): URL | null {
  const url = toUrl(raw);
  return url && HOSTS.has(url.hostname.toLowerCase()) ? url : null;
}

/** The developers.events filters in a link that the feed cannot apply, such as `region` or `callForPapers`. */
export function unsupportedLinkFilters(raw: string): string[] {
  const url = siteUrl(raw);
  if (!url) {
    return [];
  }
  return [...linkParams(url)].flatMap(([key, value]) => {
    const harmless = KNOWN_PARAMS.has(key) || value.trim() === '' || (key.endsWith('_mode') && value === 'any');
    return harmless ? [] : [key];
  });
}

/**
 * Reads the filter out of a developers.events link.
 * @returns null when the link is not on developers.events
 */
export function parseConferenceLink(raw: string): ConferenceFilter | null {
  const url = siteUrl(raw);
  if (!url) {
    return null;
  }
  const params = linkParams(url);
  const read = (keys: string[]) => keys.flatMap((key) => params.getAll(key).flatMap(splitList));
  return toFilter(read(LINK_FILTERS.topics), read(LINK_FILTERS.places), read(LINK_FILTERS.languages));
}

/** The stored feed link for a filter. Each filter is its own feed, because the link is the feed's identity. */
export function buildConferenceLink(filter: ConferenceFilter): string {
  const params = [
    ...(filter.topics.length > 0 ? [`topics=${filter.topics.map(encodeURIComponent).join(',')}`] : []),
    ...(filter.places.length > 0 ? [`places=${filter.places.map(encodeURIComponent).join(',')}`] : []),
    ...(filter.languages?.length ? [`languages=${filter.languages.map(encodeURIComponent).join(',')}`] : []),
  ];
  return params.length > 0 ? `${DATASET_URL}?${params.join('&')}` : DATASET_URL;
}

/**
 * Reads typed wizard text such as `devops, kubernetes in France, online`.
 * @returns null when the text names no topic and no place
 */
export function parseConferenceQuery(query: string): ConferenceFilter | null {
  const match = /^(.*?)(?:^|\s+)in\s+(.*)$/is.exec(query.trim());
  const topics = splitList(match ? match[1] : query);
  const places = splitList(match ? match[2] : '');
  return topics.length > 0 || places.length > 0 ? toFilter(topics, places) : null;
}

function conferenceTitle(filter: ConferenceFilter): string {
  return ['Conferences', ...[filter.topics, filter.places, filter.languages ?? []].filter((list) => list.length > 0).map((list) => list.join(', '))].join(' · ');
}

function httpLink(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function text(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

type Raw<K extends string> = Partial<Record<K, unknown>>;

function asRaw<K extends string>(value: unknown): Raw<K> {
  return typeof value === 'object' && value !== null ? value : {};
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Turns the developers.events `all-events.json` body into events, without the ones that have ended.
 * Entries that lack a name or a valid date are dropped.
 */
export function normalizeEvents(json: unknown, now = Date.now()): ConferenceEvent[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.flatMap((entry: unknown): ConferenceEvent[] => {
    const raw = asRaw<'name' | 'date' | 'hyperlink' | 'city' | 'country' | 'cfp' | 'tags'>(entry);
    const name = text(raw.name);
    const dates = Array.isArray(raw.date) ? raw.date.flatMap((value: unknown) => finite(value) ?? []) : [];
    const first = dates[0];
    const last = dates.at(-1);
    if (!name || first === undefined || last === undefined) {
      return [];
    }
    const end = last + DAY_MS - 1;
    if (end < now) {
      return [];
    }
    const cfp = asRaw<'link' | 'untilDate'>(raw.cfp);
    const tags = Array.isArray(raw.tags) ? raw.tags.flatMap((tag: unknown) => text(asRaw<'value'>(tag).value) || []) : [];
    return [{
      name,
      start: first,
      end,
      city: text(raw.city),
      country: text(raw.country),
      website: httpLink(raw.hyperlink),
      cfpLink: httpLink(cfp.link),
      cfpCloses: finite(cfp.untilDate),
      tags,
    }];
  });
}

// A city such as "Austin, TX" holds a comma, which also separates typed places, so each part is a place too.
function placesOf(city: string, country: string): string[] {
  return [...new Set([city, ...city.split(','), country].map((place) => place.trim()).filter((place) => place.length > 0))];
}

function matchesFilter(event: ConferenceEvent, filter: ConferenceFilter): boolean {
  const tags = event.tags.map((tag) => tag.toLowerCase());
  const topicOk = filter.topics.length === 0 || filter.topics.some((topic) => tags.includes(topic.toLowerCase()));
  const where = placesOf(event.city, event.country).map((place) => place.toLowerCase());
  const placeOk = filter.places.length === 0 || filter.places.some((place) => where.includes(place.toLowerCase()));
  const languageOk = !filter.languages?.length || filter.languages.some((language) => tags.includes(language));
  return topicOk && placeOk && languageOk;
}

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDay(time: number): string {
  const date = new Date(time);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatRange(start: number, end: number): string {
  const from = new Date(start);
  const to = new Date(end);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${formatDay(start)} – ${formatDay(end)}`;
  }
  if (from.getUTCMonth() !== to.getUTCMonth()) {
    return `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()]} – ${formatDay(end)}`;
  }
  if (from.getUTCDate() !== to.getUTCDate()) {
    return `${from.getUTCDate()}–${formatDay(end)}`;
  }
  return formatDay(start);
}

function placeLabel(event: ConferenceEvent): string {
  return [...new Set([event.city, event.country].filter((part) => part.length > 0))].join(', ');
}

function displayName(event: ConferenceEvent): string {
  const year = String(new Date(event.start).getUTCFullYear());
  return event.name.includes(year) ? event.name : `${event.name} ${year}`;
}

const TITLE_PREFIX: Record<Milestone, string> = {
  'announced': 'New conference',
  'cfp-open': 'CFP open',
  'cfp-closing': 'CFP closes soon',
  'soon': 'In 30 days',
  'today': 'Today',
};

function anchor(href: string, label: string): string {
  return `<a href="${escapeText(href).replace(/"/g, '&quot;')}">${escapeText(label)}</a>`;
}

function cardHtml(event: ConferenceEvent): string {
  const facts = [formatRange(event.start, event.end), placeLabel(event), ...(event.cfpLink && event.cfpCloses !== undefined ? [`CFP closes ${formatDay(event.cfpCloses)}`] : [])]
    .filter((fact) => fact.length > 0);
  const links = [
    ...(event.website ? [anchor(event.website, 'Website')] : []),
    ...(event.cfpLink ? [anchor(event.cfpLink, 'Call for papers')] : []),
  ];
  return [
    `<p><strong>${escapeText(facts.join(' · '))}</strong></p>`,
    ...(event.tags.length > 0 ? [`<p>Tags: ${escapeText(event.tags.join(', '))}</p>`] : []),
    ...(links.length > 0 ? [`<p>${links.join(' · ')}</p>`] : []),
    `<p><em>Data: ${anchor(CREDIT_URL, 'developers.events')} (CC BY-NC 4.0)</em></p>`,
  ].join('');
}

/** Each milestone that is due at `now`, with its trigger time, or an empty pubDate for "first seen". */
function dueMilestones(event: ConferenceEvent, now: number): { milestone: Milestone; pubDate: string }[] {
  const due: { milestone: Milestone; pubDate: string }[] = [];
  if (now <= event.end && event.start - ANNOUNCE_WINDOW_MS <= now) {
    due.push({ milestone: 'announced', pubDate: '' });
  }
  if (event.cfpLink && event.cfpCloses !== undefined && now < event.cfpCloses) {
    due.push({ milestone: 'cfp-open', pubDate: '' });
    if (event.cfpCloses - CFP_CLOSING_WINDOW_MS <= now) {
      due.push({ milestone: 'cfp-closing', pubDate: new Date(event.cfpCloses - CFP_CLOSING_WINDOW_MS).toISOString() });
    }
  }
  if (event.start - SOON_WINDOW_MS <= now && now < event.start) {
    due.push({ milestone: 'soon', pubDate: new Date(event.start - SOON_WINDOW_MS).toISOString() });
  }
  if (event.start <= now && now <= event.end) {
    due.push({ milestone: 'today', pubDate: new Date(event.start).toISOString() });
  }
  return due;
}

/**
 * One river card per milestone that is due at `now` for each event the filter keeps.
 * A milestone whose trigger lies in the future is never emitted.
 */
export function buildMilestoneItems(events: ConferenceEvent[], filter: ConferenceFilter, now: number): NewSourceItem[] {
  return events.filter((event) => matchesFilter(event, filter)).flatMap((event) => {
    const description = cardHtml(event);
    const year = new Date(event.start).getUTCFullYear();
    const key = [slug(event.name), slug(event.city), year].filter((part) => part !== '').join('-');
    return dueMilestones(event, now).map(({ milestone, pubDate }) => ({
      title: `${TITLE_PREFIX[milestone]}: ${displayName(event)}`,
      guid: `${key}:${milestone}`,
      link: milestone === 'cfp-open' || milestone === 'cfp-closing' ? event.cfpLink : event.website,
      pubDate,
      description,
      image: undefined,
      author: 'developers.events',
      extra: JSON.stringify({
        milestone,
        start: event.start,
        end: event.end,
        city: event.city,
        country: event.country,
        website: event.website,
        cfpLink: event.cfpLink,
        cfpCloses: event.cfpCloses,
        tags: event.tags,
      }),
      read_at: undefined,
    }));
  });
}

/** Every topic and place the dataset uses, past events included, each with how many events use it. */
export interface Vocabulary {
  topics: Map<string, number>;
  /** Keyed by the lowercase place, with the dataset's spelling and its count. */
  places: Map<string, { name: string; count: number }>;
}

export function collectVocabulary(json: unknown): Vocabulary {
  const vocabulary: Vocabulary = { topics: new Map(), places: new Map() };
  for (const entry of Array.isArray(json) ? json : []) {
    const raw = asRaw<'city' | 'country' | 'tags'>(entry);
    for (const tag of Array.isArray(raw.tags) ? raw.tags : []) {
      const topic = text(asRaw<'value'>(tag).value).toLowerCase();
      if (topic) {
        vocabulary.topics.set(topic, (vocabulary.topics.get(topic) ?? 0) + 1);
      }
    }
    for (const place of placesOf(text(raw.city), text(raw.country))) {
      const key = place.toLowerCase();
      const known = vocabulary.places.get(key);
      vocabulary.places.set(key, { name: known?.name ?? place, count: (known?.count ?? 0) + 1 });
    }
  }
  return vocabulary;
}

function listOr(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words.at(-1) ?? ''}` : words.join('');
}

function mostUsed(entries: [string, number][], limit = 3): string[] {
  return entries.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name);
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function isClose(term: string, known: string): boolean {
  return term.length >= 3 && (known.includes(term) || editDistance(term, known) <= (term.length >= 6 ? 2 : 1));
}

function topicSuggestions(topic: string, vocabulary: Vocabulary): string[] {
  const parts = [topic, ...topic.split('-')];
  return mostUsed([...vocabulary.topics].filter(([known]) => parts.some((part) => isClose(part, known))));
}

function placeSuggestions(place: string, vocabulary: Vocabulary): string[] {
  const key = place.toLowerCase();
  return mostUsed([...vocabulary.places].filter(([known]) => isClose(key, known)).map(([, { name, count }]) => [name, count]));
}

/**
 * Explains the first topics or places that no event in the dataset uses.
 * @returns undefined when every term is known, even if no event matches them all now
 */
export function checkFilter(filter: ConferenceFilter, vocabulary: Vocabulary): FeedFetchError | undefined {
  const topics = filter.topics.filter((topic) => !vocabulary.topics.has(topic));
  if (topics.length > 0) {
    const suggestions = topics.flatMap((topic) => topicSuggestions(topic, vocabulary));
    const names = listOr(topics.map((topic) => `"${topic}"`));
    const tip = suggestions.length > 0 ? `Try ${listOr([...new Set(suggestions)].slice(0, 3))}.` : 'Topics are tags such as devops, java or testing.';
    return { name: 'UNSUPPORTED_FORMAT', message: `No conference has the topic ${names}. ${tip}` };
  }
  const places = filter.places.filter((place) => !vocabulary.places.has(place.toLowerCase()));
  if (places.length > 0) {
    const suggestions = places.flatMap((place) => placeSuggestions(place, vocabulary));
    const names = listOr(places.map((place) => `"${place}"`));
    const tip = suggestions.length > 0 ? `Try ${listOr([...new Set(suggestions)].slice(0, 3))}.` : 'Use a city or a country in English, such as Paris or Germany.';
    return { name: 'UNSUPPORTED_FORMAT', message: `No conference takes place in ${names}. ${tip}` };
  }
  return undefined;
}

interface Dataset {
  events: ConferenceEvent[];
  vocabulary: Vocabulary;
}

function parseDataset(body: string): Dataset | null {
  try {
    const json: unknown = JSON.parse(body);
    return Array.isArray(json) ? { events: normalizeEvents(json), vocabulary: collectVocabulary(json) } : null;
  } catch {
    return null;
  }
}

function parse(content: string): ParsedFeedContent | null {
  const dataset = parseDataset(content);
  if (!dataset) {
    return null;
  }
  const filter: ConferenceFilter = { topics: [], places: [] };
  return { title: conferenceTitle(filter), description: DESCRIPTION, items: buildMilestoneItems(dataset.events, filter, Date.now()) };
}

// The milestones depend on the clock, so a 304 must still rebuild the cards from the last body this process read.
let cache: { validators: FetchValidators; dataset: Dataset } | undefined;

/** Forgets the cached dataset. Tests call it between cases. */
export function clearConferenceCache(): void {
  cache = undefined;
}

type LoadedEvents = Result<{ dataset: Dataset; validators: FetchValidators }, FeedFetchError>;

function fromBody(fetched: FetchedText): LoadedEvents {
  const dataset = parseDataset(fetched.body);
  if (!dataset) {
    return unsupported("This doesn't look like the developers.events dataset.");
  }
  cache = { validators: fetched.validators, dataset };
  return { success: true, data: { dataset, validators: fetched.validators } };
}

// Without cached events a 304 would leave nothing to rebuild the cards from, so only send validators when the cache is warm.
async function loadEvents(validators: FetchValidators | undefined): Promise<LoadedEvents> {
  const cached = cache;
  if (validators && cached) {
    const conditional = await fetchConditional(DATASET_URL, { validators });
    if (!conditional.success) {
      return { success: false, error: mapFetchError(conditional.error) };
    }
    if ('notModified' in conditional.data) {
      return { success: true, data: { dataset: cached.dataset, validators } };
    }
    return fromBody(conditional.data);
  }
  const full = await fetchText(DATASET_URL);
  return full.success ? fromBody(full.data) : { success: false, error: mapFetchError(full.error) };
}

/**
 * @param checkTerms refuse topics and places the dataset never uses. Only Add Feed sets it: a stored feed
 *   keeps refreshing when the dataset drops a tag.
 */
async function fetchFiltered(filter: ConferenceFilter, validators: FetchValidators | undefined, checkTerms = false): Promise<Result<{ parsed: ParsedSource; validators: FetchValidators }, FeedFetchError>> {
  try {
    const loaded = await loadEvents(validators);
    if (!loaded.success) {
      return loaded;
    }
    const refusal = checkTerms ? checkFilter(filter, loaded.data.dataset.vocabulary) : undefined;
    if (refusal) {
      return { success: false, error: refusal };
    }
    const parsed: ParsedSource = {
      type: 'conference',
      link: buildConferenceLink(filter),
      title: conferenceTitle(filter),
      description: DESCRIPTION,
      items: buildMilestoneItems(loaded.data.dataset.events, filter, Date.now()),
      icon: undefined,
    };
    return { success: true, data: { parsed, validators: loaded.data.validators } };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}

async function fetchConferences(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>> {
  const filter = parseConferenceLink(input.link);
  return filter ? fetchFiltered(filter, input.validators) : unsupported("This doesn't look like a developers.events link.");
}

async function discover(query: string): Promise<Result<ParsedSource[], FeedFetchError>> {
  const filter = parseConferenceLink(query) ?? parseConferenceQuery(query);
  if (!filter) {
    return unsupported('Type topics and places, such as "devops in France", or paste a developers.events link.');
  }
  const ignored = unsupportedLinkFilters(query);
  if (ignored.length > 0) {
    const [noun, pronoun] = ignored.length > 1 ? ['filters', 'them'] : ['filter', 'it'];
    return unsupported(`Monfil cannot apply the ${listOr(ignored)} ${noun} from developers.events. Remove ${pronoun} from the link, or type topics and places.`);
  }
  const result = await fetchFiltered(filter, undefined, true);
  return result.success ? { success: true, data: [result.data.parsed] } : result;
}

/** Whether `raw` is a developers.events link, the signal host detection and OPML import use. */
export function isConferenceLink(raw: string): boolean {
  return parseConferenceLink(raw) !== null;
}

export const conferenceSource: SourceAdapter = {
  type: 'conference',
  fetchesFullArticle: false,
  matches: isConferenceLink,
  discover,
  fetch: fetchConferences,
  parse,
};
