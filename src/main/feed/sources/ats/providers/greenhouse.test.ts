// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { greenhouse } from './greenhouse';

const jobApi = (slug: string) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

describe('greenhouse toBoard', () => {
  test.each([
    'https://boards.greenhouse.io/datadog',
    'https://boards.greenhouse.io/datadog/jobs/123',
    'https://job-boards.greenhouse.io/datadog',
    'https://BOARDS.greenhouse.io/datadog',
    'https://boards.greenhouse.io/embed/job_board?for=datadog',
    'https://boards.greenhouse.io/other?for=datadog',
    'https://boards-api.greenhouse.io/v1/boards/datadog/jobs',
    'https://boards-api.greenhouse.io/v1/boards/datadog',
    'https://boards-api.greenhouse.io/anything?for=datadog',
  ])('maps %s to the datadog board', (link) => {
    // Act
    const board = greenhouse.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'greenhouse', slug: 'datadog', apiUrl: jobApi('datadog') });
  });

  test.each([
    'https://greenhouse.io/datadog',
    'https://www.greenhouse.io/datadog',
    'https://boards.greenhouse.io.example.com/datadog',
    'https://notboards.greenhouse.io/datadog',
    'https://example.com/datadog',
    'https://example.com/?for=datadog',
    'https://boards.greenhouse.io/',
    'https://boards.greenhouse.io/embed',
    'https://boards.greenhouse.io/embed/job_board',
    'https://boards-api.greenhouse.io/',
    'https://boards-api.greenhouse.io/datadog',
    'https://boards-api.greenhouse.io/v1',
    'https://boards-api.greenhouse.io/v1/boards',
    'https://boards-api.greenhouse.io/v1/boards/',
    'https://boards-api.greenhouse.io/v2/boards/datadog/jobs',
    'https://boards-api.greenhouse.io/v1/jobs/datadog',
    'https://boards-api.greenhouse.io/boards/datadog',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(greenhouse.toBoard(new URL(link))).toBeNull();
  });
});

describe('greenhouse normalize', () => {
  test('maps a job with every field', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{
      id: 101, title: ' Data Analyst ', absolute_url: 'https://boards.greenhouse.io/acme/jobs/101', company_name: 'Acme', first_published: '2026-01-05T10:00:00-05:00',
      updated_at: '2026-10-01T00:00:00Z', location: { name: 'Paris (Hybrid)' }, departments: [{ name: 'Data' }, { name: 'Other' }],
      content: '&lt;p&gt;Pay: $90,000 &amp;mdash; $110,000&lt;/p&gt;', metadata: [{ name: 'Employment Type', value: 'Full time' }],
    }] });

    // Act
    const listing = greenhouse.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: 'Acme',
      jobs: [{
        id: '101', title: 'Data Analyst', url: 'https://boards.greenhouse.io/acme/jobs/101', html: '<p>Pay: $90,000 &mdash; $110,000</p>', publishedAt: '2026-01-05T15:00:00.000Z',
        location: 'Paris (Hybrid)', workMode: 'hybrid', salaryLabel: '$90,000 — $110,000', department: 'Data', employmentType: 'Full time',
      }],
    });
  });

  test('leaves absent fields empty', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ id: 5, title: 'Designer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/5' }] });

    // Act
    const listing = greenhouse.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: undefined,
      jobs: [{
        id: '5', title: 'Designer', url: 'https://boards.greenhouse.io/acme/jobs/5', html: '', publishedAt: '', location: undefined, workMode: undefined,
        salaryLabel: undefined, department: undefined, employmentType: undefined,
      }],
    });
  });

  test('prefers the structured pay, which is in cents, over the text', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{
      id: 6, title: 'Designer', absolute_url: 'u', location: { name: 'Remote' }, content: 'Pay $1,000 - $2,000 per year',
      pay_input_ranges: [{ min_cents: 5000000, max_cents: 7000000, currency_type: 'EUR' }],
    }] });

    // Act
    const job = greenhouse.normalize(body)?.jobs[0];

    // Assert
    expect(job).toMatchObject({ workMode: 'remote', salaryLabel: '€50,000–€70,000 / year' });
  });

  test('reads a pay range with only a minimum or only a maximum', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [
      { id: 1, title: 'Min', absolute_url: 'u', pay_input_ranges: [{ min_cents: 6000000, currency_type: 'USD' }] },
      { id: 2, title: 'Max', absolute_url: 'u', pay_input_ranges: [{ max_cents: 8000000, currency_type: 'USD' }] },
    ] });

    // Act
    const jobs = greenhouse.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.salaryLabel)).toEqual(['$60,000 / year', '$80,000 / year']);
  });

  test.each([
    [[{ name: 'Office', value: 'Paris' }, { name: 'Employment Type', value: 'Full time' }], 'Full time'],
    [[{ value: 'No name' }, { name: 'Time Type', value: 'Part time' }], 'Part time'],
    [[{ name: 'Contract', value: 'Fixed term' }], 'Fixed term'],
    [[{ name: 'Office', value: 'Paris' }], undefined],
    [[], undefined],
  ])('reads the employment type from the metadata %j as %j', (metadata, expected) => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ id: 1, title: 'Role', absolute_url: 'u', metadata }] });

    // Act
    const job = greenhouse.normalize(body)?.jobs[0];

    // Assert
    expect(job?.employmentType).toBe(expected);
  });

  test('skips a job without an id or a title', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ title: 'No id', absolute_url: 'u' }, { id: 2, absolute_url: 'u' }, { id: 3, title: 'Ok', absolute_url: 'u' }] });

    // Act
    const listing = greenhouse.normalize(body);

    // Assert
    expect(listing?.jobs.map((job) => job.id)).toEqual(['3']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(greenhouse.normalize('{"jobs": []}')).toEqual({ company: undefined, jobs: [] });
  });

  test.each(['not json', '{}', '[]', '{"jobs": {}}', '{"jobs": [{"id": 1, "title": "x", "jobUrl": "y"}]}'])('rejects %s', (body) => {
    // Act / Assert
    expect(greenhouse.normalize(body)).toBeNull();
  });
});
