// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { teamtailor } from './teamtailor';

const feed = (inner: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:tt="https://teamtailor.com/locations">${inner}</rss>`;

describe('teamtailor toBoard', () => {
  test.each([
    'https://tradera.teamtailor.com/',
    'https://tradera.teamtailor.com/jobs',
    'https://tradera.teamtailor.com/jobs/123-engineer',
    'https://TRADERA.teamtailor.com/jobs.rss',
  ])('maps %s to the tradera board', (link) => {
    // Act
    const board = teamtailor.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'teamtailor', slug: 'tradera', apiUrl: 'https://tradera.teamtailor.com/jobs.rss' });
  });

  test.each([
    'https://teamtailor.com/',
    'https://www.teamtailor.com/',
    'https://app.teamtailor.com/',
    'https://support.teamtailor.com/',
    'https://api.teamtailor.com/',
    'https://foo.bar.teamtailor.com/',
    'https://tradera.teamtailor.com.example.com/',
    'https://traderateamtailor.com/',
    'https://tradera.example.com/',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(teamtailor.toBoard(new URL(link))).toBeNull();
  });
});

describe('teamtailor normalize', () => {
  test('maps items with their Teamtailor fields', () => {
    // Arrange
    const body = feed(`<channel><title>Tradera</title>
      <item><title>Commercial Lead &amp; Co</title><description>&lt;p&gt;Pay $90,000 - $100,000&lt;/p&gt;</description><pubDate>Mon, 17 Aug 2026 13:18:38 +0200</pubDate>
        <link>https://careers.tradera.com/jobs/1</link><remoteStatus>hybrid</remoteStatus><guid>g-1</guid>
        <tt:locations><tt:location><tt:name>HQ</tt:name><tt:city>Stockholm</tt:city><tt:country>Sweden</tt:country></tt:location></tt:locations><tt:department>Marketing</tt:department></item>
      </channel>`);

    // Act
    const listing = teamtailor.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: 'Tradera',
      jobs: [{
        id: 'g-1', title: 'Commercial Lead & Co', url: 'https://careers.tradera.com/jobs/1', html: '<p>Pay $90,000 - $100,000</p>', publishedAt: '2026-08-17T11:18:38.000Z',
        location: 'Stockholm, Sweden', workMode: 'hybrid', salaryLabel: '$90,000 - $100,000', department: 'Marketing', employmentType: undefined,
      }],
    });
  });

  test('uses the link as id and leaves absent fields empty', () => {
    // Arrange
    const body = feed('<channel><title>Tradera</title><item><title>Dev</title><link>https://careers.tradera.com/jobs/2</link></item></channel>');

    // Act
    const jobs = teamtailor.normalize(body)?.jobs;

    // Assert
    expect(jobs).toEqual([{
      id: 'https://careers.tradera.com/jobs/2', title: 'Dev', url: 'https://careers.tradera.com/jobs/2', html: '', publishedAt: '', location: undefined, workMode: undefined,
      salaryLabel: undefined, department: undefined, employmentType: undefined,
    }]);
  });

  test('names a location by its name when it has no city, and joins several locations', () => {
    // Arrange
    const body = feed(`<channel><title>T</title><item><title>Dev</title><guid>g</guid><tt:locations>
      <tt:location><tt:name>HQ</tt:name><tt:country>Sweden</tt:country></tt:location>
      <tt:location><tt:city>Oslo</tt:city><tt:country>Norway</tt:country></tt:location></tt:locations></item></channel>`);

    // Act
    const job = teamtailor.normalize(body)?.jobs[0];

    // Assert
    expect(job?.location).toBe('HQ, Sweden, Oslo, Norway');
  });

  test('reads the company from the channel only, never from an item', () => {
    // Arrange
    const body = feed('<channel><item><title>Dev</title><guid>g</guid></item></channel>');

    // Act
    const listing = teamtailor.normalize(body);

    // Assert
    expect(listing?.company).toBeUndefined();
    expect(listing?.jobs).toHaveLength(1);
  });

  test('reads the company of a feed without items', () => {
    // Act / Assert
    expect(teamtailor.normalize(feed('<channel><title>Tradera</title></channel>'))).toEqual({ company: 'Tradera', jobs: [] });
  });

  test('reads the company of a feed that was cut right after its title', () => {
    // Act
    const listing = teamtailor.normalize('<rss xmlns:tt="https://teamtailor.com/locations"><channel><title>Tradera</title>');

    // Assert
    expect(listing?.company).toBe('Tradera');
  });

  test('skips an item without a title or an identity', () => {
    // Arrange
    const body = feed('<channel><title>T</title><item><guid>g1</guid></item><item><title>No id</title></item><item><title>Ok</title><guid>g3</guid></item></channel>');

    // Act
    const jobs = teamtailor.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.id)).toEqual(['g3']);
  });

  test.each([
    '<rss version="2.0"><channel><title>Blog</title></channel></rss>',
    '<channel xmlns:tt="https://teamtailor.com/locations"><title>Blog</title></channel>',
    '<feed xmlns:tt="https://teamtailor.com/locations"></feed>',
    '',
  ])('rejects %j', (body) => {
    // Act / Assert
    expect(teamtailor.normalize(body)).toBeNull();
  });
});
