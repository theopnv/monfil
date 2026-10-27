// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { lever } from './lever';

describe('lever toBoard', () => {
  test.each([
    ['https://jobs.lever.co/spotify', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://jobs.lever.co/spotify/1234-abcd', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://JOBS.lever.co/spotify', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://api.lever.co/v0/postings/spotify?mode=json', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://api.lever.co/v0/postings/spotify/1234', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://jobs.eu.lever.co/spotify', 'https://api.eu.lever.co/v0/postings/spotify?mode=json'],
    ['https://api.eu.lever.co/v0/postings/spotify', 'https://api.eu.lever.co/v0/postings/spotify?mode=json'],
  ])('maps %s to the spotify board', (link, apiUrl) => {
    // Act
    const board = lever.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'lever', slug: 'spotify', apiUrl });
  });

  test.each([
    'https://lever.co/spotify',
    'https://www.lever.co/spotify',
    'https://jobs.lever.co.example.com/spotify',
    'https://notjobs.lever.co/spotify',
    'https://jobs.us.lever.co/spotify',
    'https://example.com/v0/postings/spotify',
    'https://jobs.lever.co/',
    'https://jobs.eu.lever.co/',
    'https://api.lever.co/',
    'https://api.lever.co/spotify',
    'https://api.lever.co/v0',
    'https://api.lever.co/v0/postings',
    'https://api.lever.co/v0/postings/',
    'https://api.lever.co/v1/postings/spotify',
    'https://api.lever.co/v0/other/spotify',
    'https://api.lever.co/postings/spotify',
    'https://api.eu.lever.co/v1/postings/spotify',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(lever.toBoard(new URL(link))).toBeNull();
  });
});

describe('lever normalize', () => {
  test('maps a posting with every field to a job', () => {
    // Arrange
    const body = JSON.stringify([{
      id: 'abc', text: ' Backend Engineer ', hostedUrl: 'https://jobs.lever.co/acme/abc', createdAt: 1767225600000, workplaceType: 'hybrid',
      categories: { location: 'Paris', allLocations: ['Lyon'], team: 'Platform', department: 'Engineering', commitment: 'Full-time' },
      description: '<div>Intro</div>', lists: [{ text: 'You & me', content: '<li>Build</li>' }], additional: '<p>Equal opportunity</p>',
      salaryRange: { currency: 'EUR', interval: 'per-year-salary', min: 60000, max: 80000 },
    }]);

    // Act
    const listing = lever.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: undefined,
      jobs: [{
        id: 'abc', title: 'Backend Engineer', url: 'https://jobs.lever.co/acme/abc', html: '<div>Intro</div><h3>You &amp; me</h3><ul><li>Build</li></ul><p>Equal opportunity</p>',
        publishedAt: '2026-01-01T00:00:00.000Z', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60,000–€80,000 / year', department: 'Engineering', employmentType: 'Full-time',
      }],
    });
  });

  test('leaves absent fields empty, and uses the team when there is no department', () => {
    // Arrange
    const body = JSON.stringify([{ id: 'def', text: 'Sales', hostedUrl: 'https://jobs.lever.co/acme/def', categories: { team: 'Revenue' } }]);

    // Act
    const jobs = lever.normalize(body)?.jobs;

    // Assert
    expect(jobs).toEqual([{
      id: 'def', title: 'Sales', url: 'https://jobs.lever.co/acme/def', html: '', publishedAt: '', location: undefined, workMode: undefined,
      salaryLabel: undefined, department: 'Revenue', employmentType: undefined,
    }]);
  });

  test('builds the description from the parts that exist', () => {
    // Arrange
    const body = JSON.stringify([
      { id: '1', text: 'A', hostedUrl: 'u', description: '<p>Only description</p>' },
      { id: '2', text: 'B', hostedUrl: 'u', additional: '<p>Only additional</p>' },
      { id: '3', text: 'C', hostedUrl: 'u', lists: [{ content: '<li>x</li>' }] },
      { id: '4', text: 'D', hostedUrl: 'u', lists: [{ text: 'Heading' }] },
    ]);

    // Act
    const jobs = lever.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.html)).toEqual([
      '<p>Only description</p>',
      '<p>Only additional</p>',
      '<h3></h3><ul><li>x</li></ul>',
      '<h3>Heading</h3><ul></ul>',
    ]);
  });

  test('falls back to all locations and to the salary text', () => {
    // Arrange
    const body = JSON.stringify([
      { id: 'a', text: 'Sales', hostedUrl: 'u', categories: { allLocations: ['Lyon', 'Remote'] }, salaryDescriptionPlain: 'Base €40k–€50k', description: '<p>Pay $1,000 - $2,000 per year</p>' },
      { id: 'b', text: 'Ops', hostedUrl: 'u', description: '<p>Pay $90,000 - $110,000 per year</p>' },
    ]);

    // Act
    const jobs = lever.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => [job.location, job.workMode, job.salaryLabel])).toEqual([
      ['Lyon, Remote', 'remote', '€40k–€50k'],
      [undefined, undefined, '$90,000 - $110,000 / year'],
    ]);
  });

  test('skips a posting without an id or a title', () => {
    // Arrange
    const body = JSON.stringify([{ text: 'No id', hostedUrl: 'u' }, { id: 'x', hostedUrl: 'u' }, { id: 'ok', text: 'Ok', hostedUrl: 'u' }]);

    // Act
    const jobs = lever.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.id)).toEqual(['ok']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(lever.normalize('[]')).toEqual({ company: undefined, jobs: [] });
  });

  test.each(['{}', '[{"id": 1}]', '{"jobs": []}', 'nope'])('rejects %s', (body) => {
    // Act / Assert
    expect(lever.normalize(body)).toBeNull();
  });
});
