// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { smartrecruiters } from './smartrecruiters';

const postings = (slug: string, query = 'limit=100') => `https://api.smartrecruiters.com/v1/companies/${slug}/postings?${query}`;

describe('smartrecruiters toBoard', () => {
  test.each([
    'https://jobs.smartrecruiters.com/BoschGroup',
    'https://jobs.smartrecruiters.com/BoschGroup/7440-consultant',
    'https://careers.smartrecruiters.com/BoschGroup',
    'https://JOBS.smartrecruiters.com/BoschGroup',
    'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings',
    'https://api.smartrecruiters.com/v1/companies/BoschGroup',
  ])('maps %s to the BoschGroup board', (link) => {
    // Act
    const board = smartrecruiters.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'smartrecruiters', slug: 'BoschGroup', apiUrl: postings('BoschGroup') });
  });

  test.each([
    'https://smartrecruiters.com/BoschGroup',
    'https://www.smartrecruiters.com/BoschGroup',
    'https://jobs.smartrecruiters.com.example.com/BoschGroup',
    'https://notjobs.smartrecruiters.com/BoschGroup',
    'https://example.com/v1/companies/BoschGroup/postings',
    'https://jobs.smartrecruiters.com/',
    'https://careers.smartrecruiters.com/',
    'https://api.smartrecruiters.com/',
    'https://api.smartrecruiters.com/BoschGroup',
    'https://api.smartrecruiters.com/v1/companies',
    'https://api.smartrecruiters.com/v1/companies/',
    'https://api.smartrecruiters.com/v2/companies/BoschGroup/postings',
    'https://api.smartrecruiters.com/v1/jobs/BoschGroup/postings',
    'https://api.smartrecruiters.com/companies/BoschGroup/postings',
    'https://api.smartrecruiters.com/x/v1/companies/BoschGroup',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(smartrecruiters.toBoard(new URL(link))).toBeNull();
  });

  test.each(['country=fr', 'region=IDF', 'city=Paris', 'department=Sales', 'q=engineer'])('keeps the filter %s of an API link', (filter) => {
    // Act
    const board = smartrecruiters.toBoard(new URL(`https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?${filter}`));

    // Assert
    expect(board?.apiUrl).toBe(postings('Ubisoft2', `limit=100&${filter}`));
  });

  test('drops the filters of a board page link, which is not an API link', () => {
    // Act
    const board = smartrecruiters.toBoard(new URL('https://jobs.smartrecruiters.com/Ubisoft2?country=fr&q=dev'));

    // Assert
    expect(board?.apiUrl).toBe(postings('Ubisoft2'));
  });

  test('drops the filters of a careers page link', () => {
    // Act
    const board = smartrecruiters.toBoard(new URL('https://careers.smartrecruiters.com/Ubisoft2?city=Lyon'));

    // Assert
    expect(board?.apiUrl).toBe(postings('Ubisoft2'));
  });

  test('ignores an empty filter and an unknown filter, and sets the page size itself', () => {
    // Act
    const board = smartrecruiters.toBoard(new URL('https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?country=&limit=5&offset=10'));

    // Assert
    expect(board?.apiUrl).toBe(postings('Ubisoft2'));
  });
});

describe('smartrecruiters normalize', () => {
  test('maps a posting with every field to a job', () => {
    // Arrange
    const body = JSON.stringify({
      totalFound: 1,
      content: [{
        id: '7440', uuid: 'u1', name: ' Consultant ', company: { identifier: 'Bosch Group', name: 'Bosch Group' }, releasedDate: '2026-10-23T09:41:48.407Z',
        location: { city: 'Paris', country: 'fr', fullLocation: 'Paris, France', remote: false, hybrid: true }, department: { label: 'Consulting' }, function: { label: 'IT' },
        typeOfEmployment: { label: 'Full-time' },
      }],
    });

    // Act
    const listing = smartrecruiters.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: 'Bosch Group',
      jobs: [{
        id: '7440', title: 'Consultant', url: 'https://jobs.smartrecruiters.com/Bosch%20Group/7440', html: '<p>Consulting · Full-time · Paris, France</p>',
        publishedAt: '2026-10-23T09:41:48.407Z', location: 'Paris, France', workMode: 'hybrid', salaryLabel: undefined, department: 'Consulting', employmentType: 'Full-time',
      }],
    });
  });

  test('builds the location from the city, region and country, and the department from the function', () => {
    // Arrange
    const body = JSON.stringify({ content: [{ id: '1', uuid: 'u', name: 'Analyst', location: { city: 'Austin', region: 'TX', country: 'us' }, function: { label: 'IT' } }] });

    // Act
    const job = smartrecruiters.normalize(body)?.jobs[0];

    // Assert
    expect(job).toEqual({
      id: '1', title: 'Analyst', url: undefined, html: '<p>IT · Austin, TX, US</p>', publishedAt: '', location: 'Austin, TX, US', workMode: undefined,
      salaryLabel: undefined, department: 'IT', employmentType: undefined,
    });
  });

  test('reads a remote location as remote', () => {
    // Arrange
    const body = JSON.stringify({ content: [{ id: '1', uuid: 'u', name: 'Analyst', location: { city: 'Lyon', remote: true, hybrid: true } }] });

    // Act
    const job = smartrecruiters.normalize(body)?.jobs[0];

    // Assert
    expect(job?.workMode).toBe('remote');
  });

  test('leaves the summary empty when the posting has no facts, and escapes the facts it has', () => {
    // Arrange
    const body = JSON.stringify({ content: [
      { id: '1', uuid: 'u', name: 'Bare' },
      { id: '2', uuid: 'v', name: 'Escaped', department: { label: 'R&D <core>' } },
    ] });

    // Act
    const jobs = smartrecruiters.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.html)).toEqual(['', '<p>R&amp;D &lt;core&gt;</p>']);
  });

  test('skips a posting without an id or a name', () => {
    // Arrange
    const body = JSON.stringify({ content: [{ uuid: 'a', name: 'No id' }, { id: '2', uuid: 'b' }, { id: '3', uuid: 'c', name: 'Ok' }] });

    // Act
    const listing = smartrecruiters.normalize(body);

    // Assert
    expect(listing?.jobs.map((job) => job.id)).toEqual(['3']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(smartrecruiters.normalize('{"content": []}')).toEqual({ company: undefined, jobs: [] });
  });

  test.each([
    '{"jobs": []}',
    '{"content": {}}',
    '{"content": [{"id": "1", "name": "x"}]}',
    '{"content": [{"id": "1", "name": "x"}, {"uuid": "a"}]}',
    'not json',
  ])('rejects %s', (body) => {
    // Act / Assert
    expect(smartrecruiters.normalize(body)).toBeNull();
  });
});
