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

  test('a site filter with an empty or blank value is harmless, and "any" is harmless only for a mode', () => {
    // Act / Assert
    expect(unsupportedLinkFilters('https://developers.events/#/list?region=&city=%20')).toEqual([]);
    expect(unsupportedLinkFilters('https://developers.events/#/list?region=any&topic_mode=any&tech_mode=all')).toEqual(['region', 'tech_mode']);
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

  test('several languages are joined with commas in the link', () => {
    // Act / Assert
    expect(buildConferenceLink({ topics: ['devops'], places: ['Norway'], languages: ['english', 'french'] }))
      .toBe('https://developers.events/all-events.json?topics=devops&places=Norway&languages=english,french');
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

  test('several spaces inside a topic become one hyphen', () => {
    // Act / Assert
    expect(parseConferenceQuery('software   testing in Paris')).toEqual({ topics: ['software-testing'], places: ['Paris'] });
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

  test('an event needs only one of several topics, or one of several languages', () => {
    // Arrange
    const inEnglish = { ...devoxx, tags: [...devoxx.tags, { key: 'language', value: 'english' }] };

    // Act
    const byTopic = buildMilestoneItems(eventsAt(now, inEnglish), { topics: ['java', 'kubernetes'], places: [] }, now);
    const byLanguage = buildMilestoneItems(eventsAt(now, inEnglish), { topics: [], places: [], languages: ['english', 'french'] }, now);

    // Assert
    expect(byTopic.map((item) => item.title)).toContain('New conference: Devoxx France 2027');
    expect(byLanguage.map((item) => item.title)).toContain('New conference: Devoxx France 2027');
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

describe('milestones after the event', () => {
  test('an event that has ended has no milestone', () => {
    // Arrange
    const events = eventsAt(START, devoxx);

    // Act
    const items = buildMilestoneItems(events, NO_FILTER, END + 1);

    // Assert
    expect(items).toEqual([]);
  });
});

describe('card html', () => {
  const credit = '<p><em>Data: <a href="https://developers.events/">developers.events</a> (CC BY-NC 4.0)</em></p>';

  function firstDescription(raw: unknown, now: number): string | undefined {
    return buildMilestoneItems(eventsAt(now, raw), NO_FILTER, now)[0]?.description;
  }

  test('lists the facts, the tags and both links', () => {
    // Act
    const description = firstDescription(devoxx, CFP_CLOSES - 1);

    // Assert
    expect(description).toBe(
      '<p><strong>7–9 Apr 2027 · Paris, France · CFP closes 10 Jan 2027</strong></p>'
      + '<p>Tags: java, DevOps</p>'
      + '<p><a href="https://www.devoxx.fr/">Website</a> · <a href="https://cfp.devoxx.fr/">Call for papers</a></p>'
      + credit,
    );
  });

  test('leaves out the tags and the missing link, and an empty city', () => {
    // Arrange
    const plain = { name: 'Plain Conf', date: [START], hyperlink: 'http://plain.example/path', city: '', country: 'Online' };

    // Act
    const description = firstDescription(plain, START - 100 * DAY);

    // Assert
    expect(description).toBe(`<p><strong>7 Apr 2027 · Online</strong></p><p><a href="http://plain.example/path">Website</a></p>${credit}`);
  });

  test('a CFP link without a close date shows the link and no CFP fact, and a place named twice shows once', () => {
    // Arrange
    const cfpOnly = { name: 'Cfp Only', date: [START], city: 'Online', country: 'Online', cfp: { link: 'https://cfp.example/' } };
    const noLinks = { name: 'No Links', date: [START] };

    // Act
    const withCfp = firstDescription(cfpOnly, START - 100 * DAY);
    const bare = firstDescription(noLinks, START - 100 * DAY);

    // Assert
    expect(withCfp).toBe(`<p><strong>7 Apr 2027 · Online</strong></p><p><a href="https://cfp.example/">Call for papers</a></p>${credit}`);
    expect(bare).toBe(`<p><strong>7 Apr 2027</strong></p>${credit}`);
  });

  test.each([
    { first: Date.UTC(2027, 3, 7), last: Date.UTC(2027, 3, 7), range: '7 Apr 2027' },
    { first: Date.UTC(2027, 3, 7), last: Date.UTC(2027, 3, 9), range: '7–9 Apr 2027' },
    { first: Date.UTC(2027, 3, 30), last: Date.UTC(2027, 4, 2), range: '30 Apr – 2 May 2027' },
    { first: Date.UTC(2027, 11, 30), last: Date.UTC(2028, 0, 2), range: '30 Dec 2027 – 2 Jan 2028' },
  ])('an event from $first to $last is written as $range', ({ first, last, range }) => {
    // Act
    const description = firstDescription({ name: 'Range Conf', date: [first, last] }, first - 100 * DAY);

    // Assert
    expect(description).toBe(`<p><strong>${range}</strong></p>${credit}`);
  });
});

describe('item identity', () => {
  const now = START - 100 * DAY;

  test('the guid slug drops accents and joins other characters with single hyphens', () => {
    // Arrange
    const accented = { name: '!Café Dév & Co!', date: [START], city: 'São Paulo' };

    // Act
    const [item] = buildMilestoneItems(eventsAt(now, accented), NO_FILTER, now);

    // Assert
    expect(item?.guid).toBe('cafe-dev-co-sao-paulo-2027:announced');
  });

  test('a missing city leaves no empty part in the guid', () => {
    // Act
    const [item] = buildMilestoneItems(eventsAt(now, { name: 'Remote Conf', date: [START] }), NO_FILTER, now);

    // Assert
    expect(item?.guid).toBe('remote-conf-2027:announced');
  });

  test('the extra field carries the event details for the card', () => {
    // Act
    const [item] = buildMilestoneItems(eventsAt(now, devoxx), NO_FILTER, now);

    // Assert
    expect(JSON.parse(item?.extra ?? '{}')).toEqual({
      milestone: 'announced',
      start: START,
      end: END,
      city: 'Paris',
      country: 'France',
      website: 'https://www.devoxx.fr/',
      cfpLink: 'https://cfp.devoxx.fr/',
      cfpCloses: CFP_CLOSES,
      tags: ['java', 'DevOps'],
    });
  });
});

describe('collectVocabulary', () => {
  test('counts the events for each topic and place, and skips empty values', () => {
    // Act
    const vocabulary = collectVocabulary([
      { city: 'Paris', country: 'France', tags: [{ value: 'DevOps' }, { value: '' }] },
      { city: '', country: 'France', tags: [{ value: 'devops' }] },
      { city: 'Austin, TX', country: 'USA', tags: 'java' },
    ]);

    // Assert
    expect(vocabulary.topics).toEqual(new Map([['devops', 2]]));
    expect(vocabulary.places).toEqual(new Map([
      ['paris', { name: 'Paris', count: 1 }],
      ['france', { name: 'France', count: 2 }],
      ['austin, tx', { name: 'Austin, TX', count: 1 }],
      ['austin', { name: 'Austin', count: 1 }],
      ['tx', { name: 'TX', count: 1 }],
      ['usa', { name: 'USA', count: 1 }],
    ]));
  });

  test('anything other than an array gives an empty vocabulary', () => {
    // Act
    const vocabulary = collectVocabulary({ city: 'Paris' });

    // Assert
    expect(vocabulary.topics.size).toBe(0);
    expect(vocabulary.places.size).toBe(0);
  });
});

describe('checkFilter suggestions', () => {
  function vocabularyOfTopics(...topics: string[]) {
    return collectVocabulary(topics.map((topic) => ({ tags: [{ value: topic }] })));
  }

  test('names the three most used close tags, most used first', () => {
    // Arrange
    const used = [['contest', 1], ['testing', 2], ['tests', 3], ['unit-test', 5]] as const;
    const vocabulary = vocabularyOfTopics(...used.flatMap(([topic, count]) => Array.from({ length: count }, () => topic)));

    // Act
    const error = checkFilter({ topics: ['test'], places: [] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference has the topic "test". Try unit-test, tests or testing.');
  });

  test('keeps three suggestions in all when several topics are unknown', () => {
    // Arrange
    const vocabulary = vocabularyOfTopics('aaaa1', 'aaaa2', 'aaaa3', 'bbbb1', 'bbbb2', 'bbbb3');

    // Act
    const error = checkFilter({ topics: ['aaaa', 'bbbb'], places: [] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference has the topic "aaaa" or "bbbb". Try aaaa1, aaaa2 or aaaa3.');
  });

  test('lists three unknown topics with commas and "or"', () => {
    // Act
    const error = checkFilter({ topics: ['zzz', 'yyy', 'xxx'], places: [] }, vocabularyOfTopics('devops'));

    // Assert
    expect(error?.message).toBe('No conference has the topic "zzz", "yyy" or "xxx". Topics are tags such as devops, java or testing.');
  });

  test('keeps three place suggestions in all when several places are unknown', () => {
    // Arrange
    const cities = ['Alpha1', 'Alpha2', 'Alpha3', 'Bravo1', 'Bravo2', 'Bravo3'];
    const vocabulary = collectVocabulary(cities.map((city) => ({ city, country: 'Zed' })));

    // Act
    const error = checkFilter({ topics: [], places: ['Alpha', 'Bravo'] }, vocabulary);

    // Assert
    expect(error?.message).toBe('No conference takes place in "Alpha" or "Bravo". Try Alpha1, Alpha2 or Alpha3.');
  });

  test.each([
    ['go', 'golang', false],
    ['abc', 'xabcx', true],
    ['rusy', 'rust', true],
    ['rust', 'ruby', false],
    ['pytho', 'pythia', false],
    ['python', 'pythia', true],
    ['abcd', 'abxc', false],
  ])('the unknown topic %s is close to the tag %s: %s', (term, known, close) => {
    // Act
    const error = checkFilter({ topics: [term], places: [] }, vocabularyOfTopics(known));

    // Assert
    expect(error?.message.includes(`Try ${known}.`)).toBe(close);
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

  test('reads every field of an event', () => {
    // Act
    const events = normalizeEvents([devoxx], Date.UTC(2026, 9, 18));

    // Assert
    expect(events).toEqual([{
      name: 'Devoxx France 2027',
      start: START,
      end: END,
      city: 'Paris',
      country: 'France',
      website: 'https://www.devoxx.fr/',
      cfpLink: 'https://cfp.devoxx.fr/',
      cfpCloses: CFP_CLOSES,
      tags: ['java', 'DevOps'],
    }]);
  });

  test('trims text and gives empty defaults to missing fields', () => {
    // Act
    const events = normalizeEvents([
      { name: '  Spaced Conf ', date: [START], city: ' Paris ', country: ' France ', tags: [{ value: ' go ' }, { value: '' }, { value: '  ' }, { key: 'x' }, 'junk'] },
      { name: 'Bare Conf', date: [START], tags: 'java' },
    ], Date.UTC(2026, 9, 18));

    // Assert
    expect(events).toEqual([
      { name: 'Spaced Conf', start: START, end: START + DAY - 1, city: 'Paris', country: 'France', website: undefined, cfpLink: undefined, cfpCloses: undefined, tags: ['go'] },
      { name: 'Bare Conf', start: START, end: START + DAY - 1, city: '', country: '', website: undefined, cfpLink: undefined, cfpCloses: undefined, tags: [] },
    ]);
  });

  test('keeps an http link and drops a link that is not an http URL', () => {
    // Act
    const [plain, broken] = normalizeEvents([
      { name: 'Plain', date: [START], hyperlink: 'http://plain.example/', cfp: { link: 'not a url' } },
      { name: 'Broken', date: [START], hyperlink: 42, cfp: { link: 'ftp://files.example/cfp' } },
    ], Date.UTC(2026, 9, 18));

    // Assert
    expect(plain?.website).toBe('http://plain.example/');
    expect(plain?.cfpLink).toBeUndefined();
    expect(broken?.website).toBeUndefined();
    expect(broken?.cfpLink).toBeUndefined();
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

  test('discover names every topic, place and language in the title', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });

    // Act
    const typed = await conferenceSource.discover('devops, java in France, Online');
    const pasted = await conferenceSource.discover('https://developers.events/#/list?language=english,french');

    // Assert
    expect(typed.success && typed.data[0]?.title).toBe('Conferences · devops, java · France, Online');
    expect(pasted.success && pasted.data[0]?.title).toBe('Conferences · english, french');
  });

  test('discover asks for topics and places when the text has none', async () => {
    // Act
    const result = await conferenceSource.discover('  ,  ');

    // Assert
    expect(!result.success && result.error).toEqual({
      name: 'UNSUPPORTED_FORMAT',
      message: 'Type topics and places, such as "devops in France", or paste a developers.events link.',
    });
  });

  test('discover lists every site filter it cannot apply', async () => {
    // Act
    const result = await conferenceSource.discover('https://developers.events/#/list?region=Europe&callForPapers=true');

    // Assert
    expect(!result.success && result.error.message).toBe('Monfil cannot apply the region or callForPapers filters from developers.events. Remove them from the link, or type topics and places.');
  });

  test('a refresh of a link that is not on developers.events is refused', async () => {
    // Act
    const result = await conferenceSource.fetch({ link: 'https://example.com/all-events.json' });

    // Assert
    expect(!result.success && result.error).toEqual({ name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a developers.events link." });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('a body that is not the dataset names the dataset in its message', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '{"events":[]}', validators } });

    // Act
    const result = await conferenceSource.fetch({ link });

    // Assert
    expect(!result.success && result.error).toEqual({ name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like the developers.events dataset." });
  });

  test('a failed download is passed on as it is', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await conferenceSource.fetch({ link });

    // Assert
    expect(!result.success && result.error).toEqual({ name: 'NETWORK_ERROR', message: 'offline' });
  });

  test('a failed conditional request is passed on, and a changed body replaces the cached dataset', async () => {
    // Arrange
    vi.setSystemTime(Date.UTC(2026, 9, 18));
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });
    await conferenceSource.fetch({ link: 'https://developers.events/all-events.json' });
    mockedFetchConditional.mockResolvedValueOnce({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
    const fresh = { success: true as const, data: { body: JSON.stringify([kubecon]), validators: { etag: '"v2"', last_modified: undefined } } };
    mockedFetchConditional.mockResolvedValueOnce(fresh);

    // Act
    const failed = await conferenceSource.fetch({ link: 'https://developers.events/all-events.json', validators });
    const changed = await conferenceSource.fetch({ link: 'https://developers.events/all-events.json', validators });

    // Assert
    expect(!failed.success && failed.error).toEqual({ name: 'NETWORK_ERROR', message: 'offline' });
    expect(changed.success && 'parsed' in changed.data && changed.data.parsed.items.map((item) => item.title)).toEqual(['New conference: KubeCon Online 2027']);
    expect(changed.success && 'validators' in changed.data && changed.data.validators).toEqual({ etag: '"v2"', last_modified: undefined });
  });

  test('an error thrown while fetching becomes a parse error, and a thrown value that is not an error an unknown one', async () => {
    // Arrange
    mockedFetchText.mockRejectedValueOnce(new Error('boom'));
    mockedFetchText.mockRejectedValueOnce('boom');

    // Act
    const failed = await conferenceSource.fetch({ link });
    const unknown = await conferenceSource.fetch({ link });

    // Assert
    expect(!failed.success && failed.error).toEqual({ name: 'PARSE_ERROR', message: 'boom' });
    expect(!unknown.success && unknown.error).toEqual({ name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' });
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
