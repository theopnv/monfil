// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildConferenceLink,
  buildMilestoneItems,
  checkFilter,
  clearConferenceCache,
  collectVocabulary,
  conferenceSource,
  normalizeEvents,
  parseConferenceLink,
  parseConferenceQuery,
  unsupportedLinkFilters,
  type ConferenceEvent,
  type ConferenceFilter,
} from './conference';
import { fetchConditional, fetchText } from '../../lib/fetch';

vi.mock(import('../../lib/fetch'), () => ({
  fetchConditional: vi.fn(),
  fetchText: vi.fn(),
}));

const mockedFetchConditional = vi.mocked(fetchConditional);
const mockedFetchText = vi.mocked(fetchText);

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2027, 3, 7);
const LAST_DAY = Date.UTC(2027, 3, 9);
const END = LAST_DAY + DAY - 1;
const CFP_CLOSES = Date.UTC(2027, 0, 10);
const NO_FILTER: ConferenceFilter = { topics: [], places: [] };

const devoxx = {
  name: 'Devoxx France 2027',
  date: [START, LAST_DAY],
  hyperlink: 'https://www.devoxx.fr/',
  city: 'Paris',
  country: 'France',
  cfp: { link: 'https://cfp.devoxx.fr/', untilDate: CFP_CLOSES },
  tags: [{ key: 'tech', value: 'java' }, { key: 'topic', value: 'DevOps' }],
};

const kubecon = {
  name: 'KubeCon Online',
  date: [Date.UTC(2027, 1, 2)],
  hyperlink: 'https://kubecon.example/',
  city: 'Online',
  country: 'Online',
  cfp: {},
  tags: [{ key: 'topic', value: 'kubernetes' }],
};

const helloStavanger = {
  name: 'HelloStavanger 2027',
  date: [Date.UTC(2027, 2, 3)],
  hyperlink: 'https://hellostavanger.example/',
  city: 'Stavanger',
  country: 'Norway',
  cfp: {},
  tags: [{ key: 'tech', value: 'javascript' }],
};

const texas = { ...kubecon, name: 'Texas Linux Fest', city: 'Austin, TX', country: 'USA', tags: [{ key: 'topic', value: 'linux' }] };

const ended = { name: 'Old Conf', date: [Date.UTC(2020, 0, 1)], hyperlink: 'https://old.example/', city: 'Lyon', country: 'France', cfp: {}, tags: [] };

function eventsAt(now: number, ...raw: unknown[]): ConferenceEvent[] {
  return normalizeEvents(raw, now);
}

function milestonesAt(now: number, raw: unknown = devoxx): string[] {
  return buildMilestoneItems(eventsAt(now, raw), NO_FILTER, now).map((item) => item.guid.split(':')[1] ?? '');
}

describe('parseConferenceLink', () => {
  test('reads topics and places from the query string', () => {
    // Act
    const filter = parseConferenceLink('https://developers.events/all-events.json?topics=devops,kubernetes&places=France,Online');

    // Assert
    expect(filter).toEqual({ topics: ['devops', 'kubernetes'], places: ['France', 'Online'] });
  });

  test('a developers.events link without a query keeps every event', () => {
    // Act / Assert
    expect(parseConferenceLink('developers.events')).toEqual(NO_FILTER);
  });

  test('reads the filters of a site page link from its hash route', () => {
    // Act
    const filter = parseConferenceLink('https://developers.events/#/2026/list?country=Norway&language=english');

    // Assert
    expect(filter).toEqual({ topics: [], places: ['Norway'], languages: ['english'] });
  });

  test('site topic and tech filters both become topics', () => {
    // Act / Assert
    expect(parseConferenceLink('https://developers.events/#/list?topic=devops&tech=java,kotlin&topic_mode=any')).toEqual({ topics: ['devops', 'java', 'kotlin'], places: [] });
  });

  test('site filters that Monfil cannot apply are reported', () => {
    // Act / Assert
    expect(unsupportedLinkFilters('https://developers.events/#/2026/list?country=Norway&region=Europe&topic_mode=all&callForPapers=true')).toEqual(['region', 'topic_mode', 'callForPapers']);
    expect(unsupportedLinkFilters('https://developers.events/#/2026/list?country=Norway&language=english&topic_mode=any')).toEqual([]);
  });

  test('a language filter keeps only events with that language tag', () => {
    // Arrange
    const now = Date.UTC(2026, 9, 18);
    const inEnglish = { ...helloStavanger, tags: [...helloStavanger.tags, { key: 'language', value: 'english' }] };

    // Act
    const items = buildMilestoneItems(eventsAt(now, devoxx, inEnglish), { topics: [], places: ['France', 'Norway'], languages: ['english'] }, now);

    // Assert
    expect(items.map((item) => item.title)).toEqual(['New conference: HelloStavanger 2027']);
  });

  test('a built link with languages parses back to the same filter', () => {
    // Arrange
    const filter: ConferenceFilter = { topics: ['devops'], places: ['Norway'], languages: ['english'] };

    // Act / Assert
    expect(parseConferenceLink(buildConferenceLink(filter))).toEqual(filter);
  });

  test('another host is not a conference link', () => {
    // Act / Assert
    expect(parseConferenceLink('https://example.com/all-events.json?topics=devops')).toBeNull();
    expect(parseConferenceLink('devops in France')).toBeNull();
  });

  test('a built link parses back to the same filter and the same link', () => {
    // Arrange
    const filter: ConferenceFilter = { topics: ['devops', 'c++'], places: ['France', 'New Zealand'] };

    // Act
    const link = buildConferenceLink(filter);
    const parsed = parseConferenceLink(link);

    // Assert
    expect(parsed).toEqual(filter);
    expect(parsed && buildConferenceLink(parsed)).toBe(link);
  });

  test('a filter with no topic and no place builds the bare dataset link', () => {
    // Act / Assert
    expect(buildConferenceLink(NO_FILTER)).toBe('https://developers.events/all-events.json');
  });
});

describe('parseConferenceQuery', () => {
  test('text before "in" is topics and text after is places', () => {
    // Act / Assert
    expect(parseConferenceQuery('devops, Kubernetes in France, Belgium, online')).toEqual({ topics: ['devops', 'kubernetes'], places: ['France', 'Belgium', 'Online'] });
  });

  test('places are optional', () => {
    // Act / Assert
    expect(parseConferenceQuery('devops')).toEqual({ topics: ['devops'], places: [] });
  });

  test('topics are optional', () => {
    // Act / Assert
    expect(parseConferenceQuery('in France')).toEqual({ topics: [], places: ['France'] });
  });

  test('"in" inside a word does not split the text', () => {
    // Act / Assert
    expect(parseConferenceQuery('linkedin')).toEqual({ topics: ['linkedin'], places: [] });
  });

  test('spaces inside a topic become hyphens, as in the dataset tags', () => {
    // Act / Assert
    expect(parseConferenceQuery('software testing in Paris')).toEqual({ topics: ['software-testing'], places: ['Paris'] });
  });

  test('empty text is not a query', () => {
    // Act / Assert
    expect(parseConferenceQuery('  ,  ')).toBeNull();
  });
});

describe('buildMilestoneItems filters', () => {
  const now = Date.UTC(2026, 9, 18);

  test('a topic matches any tag value, ignoring case', () => {
    // Act
    const items = buildMilestoneItems(eventsAt(now, devoxx, kubecon), { topics: ['devops'], places: [] }, now);

    // Assert
    expect(new Set(items.map((item) => item.title))).toEqual(new Set(['New conference: Devoxx France 2027', 'CFP open: Devoxx France 2027']));
  });

  test('a place matches the city or the country', () => {
    // Act
    const byCity = buildMilestoneItems(eventsAt(now, devoxx, kubecon), { topics: [], places: ['paris'] }, now);
    const byCountry = buildMilestoneItems(eventsAt(now, devoxx, kubecon), { topics: [], places: ['Online'] }, now);

    // Assert
    expect(byCity.every((item) => item.title.includes('Devoxx'))).toBe(true);
    expect(byCity).not.toHaveLength(0);
    expect(byCountry.map((item) => item.title)).toEqual(['New conference: KubeCon Online 2027']);
  });

  test('each part of a city with a comma is a place', () => {
    // Act
    const byCity = buildMilestoneItems(eventsAt(now, texas), { topics: [], places: ['Austin'] }, now);
    const byState = buildMilestoneItems(eventsAt(now, texas), { topics: [], places: ['TX'] }, now);

    // Assert
    expect(byCity.map((item) => item.title)).toEqual(['New conference: Texas Linux Fest 2027']);
    expect(byState.map((item) => item.title)).toEqual(['New conference: Texas Linux Fest 2027']);
  });

  test('an event needs a matching topic and a matching place', () => {
    // Act / Assert
    expect(buildMilestoneItems(eventsAt(now, devoxx), { topics: ['java'], places: ['Belgium'] }, now)).toEqual([]);
  });
});

describe('milestone windows', () => {
  test('announced starts 12 months before the event', () => {
    // Act / Assert
    expect(milestonesAt(START - 365 * DAY - 1, { ...devoxx, cfp: {} })).toEqual([]);
    expect(milestonesAt(START - 365 * DAY, { ...devoxx, cfp: {} })).toEqual(['announced']);
  });

  test('cfp-open lasts until the close date', () => {
    // Act / Assert
    expect(milestonesAt(CFP_CLOSES - 30 * DAY)).toEqual(['announced', 'cfp-open']);
    expect(milestonesAt(CFP_CLOSES)).toEqual(['announced']);
  });

  test('cfp-open needs a CFP link', () => {
    // Act / Assert
    expect(milestonesAt(CFP_CLOSES - 30 * DAY, { ...devoxx, cfp: { untilDate: CFP_CLOSES } })).toEqual(['announced']);
  });

  test('cfp-closing covers the 14 days before the close date', () => {
    // Act / Assert
    expect(milestonesAt(CFP_CLOSES - 14 * DAY - 1)).toEqual(['announced', 'cfp-open']);
    expect(milestonesAt(CFP_CLOSES - 14 * DAY)).toEqual(['announced', 'cfp-open', 'cfp-closing']);
    expect(milestonesAt(CFP_CLOSES - 1)).toEqual(['announced', 'cfp-open', 'cfp-closing']);
  });

  test('soon covers the 30 days before the start', () => {
    // Act / Assert
    expect(milestonesAt(START - 30 * DAY - 1)).toEqual(['announced']);
    expect(milestonesAt(START - 30 * DAY)).toEqual(['announced', 'soon']);
    expect(milestonesAt(START - 1)).toEqual(['announced', 'soon']);
  });

  test('today covers every day of the event, up to the end of the last day', () => {
    // Act / Assert
    expect(milestonesAt(START)).toEqual(['announced', 'today']);
    expect(milestonesAt(END)).toEqual(['announced', 'today']);
    expect(milestonesAt(END + 1)).toEqual([]);
  });

  test('dated milestones carry their trigger time and undated ones an empty pubDate', () => {
    // Arrange
    const now = CFP_CLOSES - 1;

    // Act
    const items = buildMilestoneItems(eventsAt(now, devoxx), NO_FILTER, now);

    // Assert
    expect(Object.fromEntries(items.map((item) => [item.guid, item.pubDate]))).toEqual({
      'devoxx-france-2027-paris-2027:announced': '',
      'devoxx-france-2027-paris-2027:cfp-open': '',
      'devoxx-france-2027-paris-2027:cfp-closing': new Date(CFP_CLOSES - 14 * DAY).toISOString(),
    });
  });

  test('no card has a trigger in the future', () => {
    // Arrange
    const times = Array.from({ length: 500 }, (_, index) => START - 400 * DAY + index * DAY);

    // Act
    const future = times.flatMap((now) => buildMilestoneItems(eventsAt(now, devoxx, kubecon), NO_FILTER, now)
      .filter((item) => item.pubDate !== '' && Date.parse(item.pubDate) > now));

    // Assert
    expect(future).toEqual([]);
  });
});

describe('card content', () => {
  const now = CFP_CLOSES - 1;

  test('a guid stays the same when the event details change', () => {
    // Arrange
    const changed = { ...devoxx, hyperlink: 'https://devoxx.fr/2027', tags: [], cfp: { link: 'https://other.example/cfp', untilDate: CFP_CLOSES + DAY } };

    // Act
    const before = buildMilestoneItems(eventsAt(now, devoxx), NO_FILTER, now).map((item) => item.guid);
    const after = buildMilestoneItems(eventsAt(now, changed), NO_FILTER, now).map((item) => item.guid);

    // Assert
    expect(after).toEqual(before);
  });

  test('the description opens with the key facts and ends with the data credit', () => {
    // Act
    const [item] = buildMilestoneItems(eventsAt(now, devoxx), NO_FILTER, now);

    // Assert
    expect(item?.description.startsWith('<p><strong>7–9 Apr 2027 · Paris, France · CFP closes 10 Jan 2027</strong></p>')).toBe(true);
    expect(item?.description.endsWith('<p><em>Data: <a href="https://developers.events/">developers.events</a> (CC BY-NC 4.0)</em></p>')).toBe(true);
    expect(item?.author).toBe('developers.events');
  });

  test('CFP cards link to the CFP and other cards link to the website', () => {
    // Act
    const items = buildMilestoneItems(eventsAt(now, devoxx), NO_FILTER, now);

    // Assert
    expect(Object.fromEntries(items.map((item) => [item.guid.split(':')[1], item.link]))).toEqual({
      'announced': 'https://www.devoxx.fr/',
      'cfp-open': 'https://cfp.devoxx.fr/',
      'cfp-closing': 'https://cfp.devoxx.fr/',
    });
  });

  test('dataset text is escaped', () => {
    // Arrange
    const hostile = { ...devoxx, name: '<img src=x onerror=alert(1)> Conf', city: 'Tom & Jerry', tags: [{ key: 'topic', value: '<b>x</b>' }] };

    // Act
    const [item] = buildMilestoneItems(eventsAt(now, hostile), NO_FILTER, now);

    // Assert
    expect(item?.description).not.toContain('<img');
    expect(item?.description).not.toContain('<b>');
    expect(item?.description).toContain('Tom &amp; Jerry');
    expect(item?.description).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  test('only http and https links are kept', () => {
    // Arrange
    const unsafe = { ...devoxx, hyperlink: 'javascript:alert(1)', cfp: { link: 'data:text/html,hi', untilDate: CFP_CLOSES } };

    // Act
    const items = buildMilestoneItems(eventsAt(now, unsafe), NO_FILTER, now);

    // Assert
    expect(items.map((item) => item.guid.split(':')[1])).toEqual(['announced']);
    expect(items[0]?.link).toBeUndefined();
    expect(items[0]?.description).not.toMatch(/javascript:|data:/);
  });
});

describe('checkFilter', () => {
  const vocabulary = collectVocabulary([
    devoxx, kubecon, helloStavanger, texas, ended,
    { ...ended, tags: [{ key: 'topic', value: 'testing' }] },
    { ...ended, tags: [{ key: 'topic', value: 'testing' }, { key: 'topic', value: 'software-testing' }] },
  ]);

  test('known topics and places pass, even when no event matches them all', () => {
    // Act / Assert
    expect(checkFilter({ topics: ['devops'], places: ['Stavanger'] }, vocabulary)).toBeUndefined();
  });

  test('topics and places from past events are known', () => {
    // Act / Assert
    expect(checkFilter({ topics: [], places: ['Lyon'] }, vocabulary)).toBeUndefined();
  });

  test('an unknown topic names the closest tags, most used first', () => {
    // Act
    const error = checkFilter({ topics: ['test-automation'], places: ['Paris'] }, vocabulary);

    // Assert
    expect(error).toEqual({ name: 'UNSUPPORTED_FORMAT', message: 'No conference has the topic "test-automation". Try testing or software-testing.' });
  });

  test('an unknown topic without a close tag gives examples', () => {
    // Act
    const error = checkFilter({ topics: ['zzz'], places: [] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference has the topic "zzz". Topics are tags such as devops, java or testing.');
  });

  test('an unknown place names a close place', () => {
    // Act
    const error = checkFilter({ topics: [], places: ['Parris'] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference takes place in "Parris". Try Paris.');
  });

  test('an unknown place without a close place asks for a city or a country', () => {
    // Act
    const error = checkFilter({ topics: [], places: ['Atlantis'] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference takes place in "Atlantis". Use a city or a country in English, such as Paris or Germany.');
  });
});

describe('normalizeEvents', () => {
  test('drops ended events and entries without a name or a date', () => {
    // Act
    const events = normalizeEvents([devoxx, ended, { name: '', date: [START] }, { name: 'No date', date: [] }, 'junk'], Date.UTC(2026, 9, 18));

    // Assert
    expect(events.map((event) => event.name)).toEqual(['Devoxx France 2027']);
  });

  test('anything other than an array gives no events', () => {
    // Act / Assert
    expect(normalizeEvents({ events: [devoxx] })).toEqual([]);
  });
});

describe('conferenceSource', () => {
  const link = 'https://developers.events/all-events.json?topics=devops&places=France';
  const body = JSON.stringify([devoxx, kubecon, ended]);
  const validators = { etag: '"v1"', last_modified: undefined };

  beforeEach(() => {
    clearConferenceCache();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  test('discover turns typed text into the canonical link, title and cards', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });

    // Act
    const result = await conferenceSource.discover('devops in france');

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('https://developers.events/all-events.json');
    expect(result.success && result.data.map((source) => [source.type, source.link, source.title])).toEqual([
      ['conference', link, 'Conferences · devops · France'],
    ]);
    expect(result.success && result.data[0]?.items.map((item) => item.title)).toEqual(['New conference: Devoxx France 2027', 'CFP open: Devoxx France 2027']);
  });

  test('discover refuses a site link with filters it cannot apply', async () => {
    // Act
    const result = await conferenceSource.discover('https://developers.events/#/2026/list?country=Norway&region=Europe');

    // Assert
    expect(!result.success && result.error.message).toBe('Monfil cannot apply the region filter from developers.events. Remove it from the link, or type topics and places.');
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('discover refuses a topic that no conference uses', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });

    // Act
    const result = await conferenceSource.discover('test automation in paris');

    // Assert
    expect(!result.success && result.error.message).toMatch(/^No conference has the topic "test-automation"\./);
  });

  test('discover accepts known terms that match no conference now', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body: JSON.stringify([devoxx, helloStavanger]), validators } });

    // Act
    const result = await conferenceSource.discover('devops in Stavanger');

    // Assert
    expect(result.success && result.data.map((source) => source.items.length)).toEqual([0]);
  });

  test('a refresh keeps working when the dataset no longer uses a topic', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });

    // Act
    const result = await conferenceSource.fetch({ link: 'https://developers.events/all-events.json?topics=gone' });

    // Assert
    expect(result.success && 'parsed' in result.data && result.data.parsed.items).toEqual([]);
  });

  test('a 304 rebuilds the cards from the cached dataset at the current time', async () => {
    // Arrange
    vi.setSystemTime(START - 31 * DAY);
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });
    mockedFetchConditional.mockResolvedValue({ success: true, data: { notModified: true } });
    await conferenceSource.fetch({ link });
    vi.setSystemTime(START - 29 * DAY);

    // Act
    const result = await conferenceSource.fetch({ link, validators });

    // Assert
    expect(mockedFetchConditional).toHaveBeenCalledWith('https://developers.events/all-events.json', { validators });
    expect(result.success && 'parsed' in result.data && result.data.parsed.items.map((item) => item.guid)).toEqual([
      'devoxx-france-2027-paris-2027:announced',
      'devoxx-france-2027-paris-2027:soon',
    ]);
    expect(result.success && 'validators' in result.data && result.data.validators).toEqual(validators);
  });

  test('without a cached dataset, a refresh fetches the full body instead of sending validators', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators: { etag: '"v2"', last_modified: undefined } } });

    // Act
    const result = await conferenceSource.fetch({ link, validators });

    // Assert
    expect(mockedFetchConditional).not.toHaveBeenCalled();
    expect(result.success && 'parsed' in result.data && result.data.parsed.items).toHaveLength(2);
  });

  test('a body that is not the dataset is an unsupported format', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<html></html>', validators } });

    // Act
    const result = await conferenceSource.fetch({ link });

    // Assert
    expect(!result.success && result.error.name).toBe('UNSUPPORTED_FORMAT');
  });

  test('parse keeps every event and uses the current time', () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));

    // Act
    const parsed = conferenceSource.parse(body);

    // Assert
    expect(parsed?.title).toBe('Conferences');
    expect(parsed?.items.map((item) => item.guid)).toEqual([
      'devoxx-france-2027-paris-2027:announced',
      'devoxx-france-2027-paris-2027:cfp-open',
      'kubecon-online-online-2027:announced',
    ]);
  });
});
