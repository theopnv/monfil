// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { workable } from './workable';

const widgetApi = (slug: string) => `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;

describe('workable toBoard', () => {
  test.each([
    ['https://apply.workable.com/huggingface/', 'huggingface'],
    ['https://apply.workable.com/huggingface/j/ABC123/', 'huggingface'],
    ['https://APPLY.workable.com/huggingface', 'huggingface'],
    ['https://apply.workable.com/api/v1/widget/accounts/huggingface', 'huggingface'],
    ['https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true', 'huggingface'],
    ['https://www.workable.com/api/accounts/acme', 'acme'],
    ['https://www.workable.com/api/accounts/acme?details=true', 'acme'],
  ])('maps %s to the board %s', (link, slug) => {
    // Act
    const board = workable.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'workable', slug, apiUrl: widgetApi(slug) });
  });

  test.each([
    'https://workable.com/acme',
    'https://jobs.workable.com/acme',
    'https://apply.workable.com.example.com/acme',
    'https://notapply.workable.com/acme',
    'https://example.com/api/v1/widget/accounts/acme',
    'https://apply.workable.com/',
    'https://apply.workable.com/j/ABC123',
    'https://www.workable.com/',
    'https://www.workable.com/acme',
    'https://www.workable.com/api/accounts',
    'https://www.workable.com/api/v1/widget/accounts/acme',
    'https://www.workable.com/v1/accounts/acme',
    'https://www.workable.com/api/jobs/acme',
    'https://apply.workable.com/api',
    'https://apply.workable.com/api/accounts/acme',
    'https://apply.workable.com/api/v1/widget/accounts',
    'https://apply.workable.com/api/v2/widget/accounts/acme',
    'https://apply.workable.com/api/v1/jobs/accounts/acme',
    'https://apply.workable.com/api/v1/widget/jobs/acme',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(workable.toBoard(new URL(link))).toBeNull();
  });
});

describe('workable normalize', () => {
  test('maps a listing with every field', () => {
    // Arrange
    const body = JSON.stringify({
      name: 'Acme',
      jobs: [{
        title: ' ML Engineer ', shortcode: 'AAA', url: 'https://apply.workable.com/j/AAA', shortlink: 'https://apply.workable.com/j/short', published_on: '2026-05-29', created_at: '2026-01-01',
        city: 'Paris', state: 'Île-de-France', country: 'France', telecommuting: true, department: 'AI', employment_type: 'Full-time', description: '<p>Pay €70k-€90k</p>',
      }],
    });

    // Act
    const listing = workable.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: 'Acme',
      jobs: [{
        id: 'AAA', title: 'ML Engineer', url: 'https://apply.workable.com/j/AAA', html: '<p>Pay €70k-€90k</p>', publishedAt: '2026-05-29T00:00:00.000Z',
        location: 'Paris, Île-de-France, France', workMode: 'remote', salaryLabel: '€70k-€90k', department: 'AI', employmentType: 'Full-time',
      }],
    });
  });

  test('falls back to the short link and the creation date, and leaves absent fields empty', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ title: 'Office Manager', shortcode: 'BBB', shortlink: 'https://apply.workable.com/j/BBB', created_at: '2026-02-01' }] });

    // Act
    const listing = workable.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: undefined,
      jobs: [{
        id: 'BBB', title: 'Office Manager', url: 'https://apply.workable.com/j/BBB', html: '', publishedAt: '2026-02-01T00:00:00.000Z',
        location: undefined, workMode: undefined, salaryLabel: undefined, department: undefined, employmentType: undefined,
      }],
    });
  });

  test('does not read telecommuting false as remote', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ title: 'Clerk', shortcode: 'CCC', telecommuting: false }] });

    // Act
    const job = workable.normalize(body)?.jobs[0];

    // Assert
    expect(job?.workMode).toBeUndefined();
  });

  test('skips a job without a shortcode or a title', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ shortcode: 'AAA' }, { title: 'No code' }, { title: 'Ok', shortcode: 'BBB' }] });

    // Act
    const listing = workable.normalize(body);

    // Assert
    expect(listing?.jobs.map((job) => job.id)).toEqual(['BBB']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(workable.normalize('{"name": "Acme", "jobs": []}')).toEqual({ company: 'Acme', jobs: [] });
  });

  test.each([
    '{"name": "x"}',
    '{"jobs": {}}',
    '{"jobs": [{"id": 1, "title": "x", "absolute_url": "y"}]}',
    '{"jobs": [{"title": "x"}, {"shortcode": "A", "title": "y"}]}',
    'not json',
  ])('rejects %s', (body) => {
    // Act / Assert
    expect(workable.normalize(body)).toBeNull();
  });
});
