// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { recruitee } from './recruitee';

describe('recruitee toBoard', () => {
  test.each([
    'https://bunq.recruitee.com/',
    'https://bunq.recruitee.com/o/product-manager',
    'https://BUNQ.recruitee.com/api/offers/',
  ])('maps %s to the bunq board', (link) => {
    // Act
    const board = recruitee.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'recruitee', slug: 'bunq', apiUrl: 'https://bunq.recruitee.com/api/offers/' });
  });

  test.each([
    'https://recruitee.com/',
    'https://www.recruitee.com/',
    'https://api.recruitee.com/',
    'https://app.recruitee.com/',
    'https://support.recruitee.com/',
    'https://status.recruitee.com/',
    'https://foo.bar.recruitee.com/',
    'https://bunq.recruitee.com.example.com/',
    'https://bunqrecruitee.com/',
    'https://bunq.example.com/',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(recruitee.toBoard(new URL(link))).toBeNull();
  });
});

describe('recruitee normalize', () => {
  test('maps an offer with every field to a job', () => {
    // Arrange
    const body = JSON.stringify({ offers: [{
      id: 1, title: ' Product Manager ', company_name: 'bunq', careers_url: 'https://careers.bunq.com/o/pm', published_at: '2026-10-15 09:31:36 UTC', created_at: '2026-01-01 00:00:00 UTC',
      location: 'Amsterdam, Netherlands', city: 'Rotterdam', country: 'Belgium', department: 'Product', employment_type_code: 'fulltime_permanent', description: '<p>About</p>',
      requirements: '<ul><li>SQL</li></ul>', salary: { min: 5000, max: 6000, currency: 'EUR', period: 'month' },
    }] });

    // Act
    const listing = recruitee.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: 'bunq',
      jobs: [{
        id: '1', title: 'Product Manager', url: 'https://careers.bunq.com/o/pm', html: '<p>About</p><h3>Requirements</h3><ul><li>SQL</li></ul>', publishedAt: '2026-10-15T09:31:36.000Z',
        location: 'Amsterdam, Netherlands', workMode: undefined, salaryLabel: '€5,000–€6,000 / month', department: 'Product', employmentType: 'fulltime_permanent',
      }],
    });
  });

  test('builds the location from the city and country, and dates from the creation time', () => {
    // Arrange
    const body = JSON.stringify({ offers: [{ id: 2, title: 'Intern', city: 'Sofia', country: 'Bulgaria', created_at: '2026-02-01 08:00:00 UTC' }] });

    // Act
    const job = recruitee.normalize(body)?.jobs[0];

    // Assert
    expect(job).toEqual({
      id: '2', title: 'Intern', url: undefined, html: '', publishedAt: '2026-02-01T08:00:00.000Z', location: 'Sofia, Bulgaria', workMode: undefined,
      salaryLabel: undefined, department: undefined, employmentType: undefined,
    });
  });

  test.each([
    [{ remote: true, hybrid: true, on_site: true }, 'remote'],
    [{ hybrid: true, on_site: true }, 'hybrid'],
    [{ on_site: true }, 'on-site'],
    [{ remote: false, hybrid: false, on_site: false }, undefined],
    [{}, undefined],
  ])('reads the flags %j as the work mode %j', (flags, expected) => {
    // Arrange
    const body = JSON.stringify({ offers: [{ id: 1, title: 'Role', ...flags }] });

    // Act
    const job = recruitee.normalize(body)?.jobs[0];

    // Assert
    expect(job?.workMode).toBe(expected);
  });

  test('puts the requirements alone in the description when there is no description', () => {
    // Arrange
    const body = JSON.stringify({ offers: [{ id: 1, title: 'Role', requirements: '<p>SQL</p>' }] });

    // Act
    const job = recruitee.normalize(body)?.jobs[0];

    // Assert
    expect(job?.html).toBe('<h3>Requirements</h3><p>SQL</p>');
  });

  test('reads the salary from the text of the offer when it has no structured pay', () => {
    // Arrange
    const body = JSON.stringify({ offers: [{ id: 1, title: 'Role', description: '<p>Pay: $90,000 - $110,000 per year</p>' }] });

    // Act
    const job = recruitee.normalize(body)?.jobs[0];

    // Assert
    expect(job?.salaryLabel).toBe('$90,000 - $110,000 / year');
  });

  test('skips an offer without an id or a title', () => {
    // Arrange
    const body = JSON.stringify({ offers: [{ title: 'No id' }, { id: 3 }, { id: 4, title: 'Ok' }] });

    // Act
    const listing = recruitee.normalize(body);

    // Assert
    expect(listing?.jobs.map((job) => job.id)).toEqual(['4']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(recruitee.normalize('{"offers": []}')).toEqual({ company: undefined, jobs: [] });
  });

  test.each(['{}', '{"offers": {}}', '{"jobs": []}', 'not json'])('rejects %s', (body) => {
    // Act / Assert
    expect(recruitee.normalize(body)).toBeNull();
  });
});
