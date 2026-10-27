// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { ashby } from './ashby';

const jobApi = (slug: string) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;

describe('ashby toBoard', () => {
  test.each([
    'https://jobs.ashbyhq.com/ramp',
    'https://jobs.ashbyhq.com/ramp/3f2a-uuid',
    'https://JOBS.ashbyhq.com/ramp',
    'https://api.ashbyhq.com/posting-api/job-board/ramp',
    'https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true',
  ])('maps %s to the ramp board', (link) => {
    // Act
    const board = ashby.toBoard(new URL(link));

    // Assert
    expect(board).toEqual({ provider: 'ashby', slug: 'ramp', apiUrl: jobApi('ramp') });
  });

  test.each([
    'https://ashbyhq.com/ramp',
    'https://www.ashbyhq.com/ramp',
    'https://jobs.ashbyhq.com.example.com/ramp',
    'https://notjobs.ashbyhq.com/ramp',
    'https://example.com/posting-api/job-board/ramp',
    'https://jobs.ashbyhq.com/',
    'https://api.ashbyhq.com/',
    'https://api.ashbyhq.com/ramp',
    'https://api.ashbyhq.com/posting-api',
    'https://api.ashbyhq.com/posting-api/job-board',
    'https://api.ashbyhq.com/posting-api/job-board/',
    'https://api.ashbyhq.com/posting-api/other/ramp',
    'https://api.ashbyhq.com/other/job-board/ramp',
    'https://api.ashbyhq.com/job-board/ramp',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(ashby.toBoard(new URL(link))).toBeNull();
  });
});

describe('ashby normalize', () => {
  test('maps a posting with every field to a job', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{
      id: 'a1', title: ' Analytics Engineer ', department: 'Data', team: 'BI', employmentType: 'FullTime', location: 'Paris', workplaceType: 'OnSite', isRemote: true,
      publishedAt: '2026-03-01T09:00:00.000+00:00', jobUrl: 'https://jobs.ashbyhq.com/acme/a1', descriptionHtml: '<p>Hello</p>',
      compensation: { summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 100000, maxValue: 130000 }] },
    }] });

    // Act
    const listing = ashby.normalize(body);

    // Assert
    expect(listing).toEqual({
      company: undefined,
      jobs: [{
        id: 'a1', title: 'Analytics Engineer', url: 'https://jobs.ashbyhq.com/acme/a1', html: '<p>Hello</p>', publishedAt: '2026-03-01T09:00:00.000Z', location: 'Paris',
        workMode: 'on-site', salaryLabel: '$100,000–$130,000 / year', department: 'Data', employmentType: 'FullTime',
      }],
    });
  });

  test('leaves absent fields empty, and uses the team when there is no department', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ id: 'a2', title: 'Support', team: 'CX', jobUrl: 'https://jobs.ashbyhq.com/acme/a2' }] });

    // Act
    const listing = ashby.normalize(body);

    // Assert
    expect(listing?.jobs).toEqual([{
      id: 'a2', title: 'Support', url: 'https://jobs.ashbyhq.com/acme/a2', html: '', publishedAt: '', location: undefined, workMode: undefined,
      salaryLabel: undefined, department: 'CX', employmentType: undefined,
    }]);
  });

  test('reads isRemote true as remote and isRemote false as no work mode', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [
      { id: 'r', title: 'Remote one', isRemote: true, jobUrl: 'u' },
      { id: 'n', title: 'Office one', isRemote: false, jobUrl: 'u' },
    ] });

    // Act
    const jobs = ashby.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.workMode)).toEqual(['remote', undefined]);
  });

  test('takes the salary component of the compensation and ignores the other kinds', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{
      id: 'a3', title: 'Dev', jobUrl: 'u',
      compensation: { summaryComponents: [
        { compensationType: 'Bonus', interval: '1 YEAR', currencyCode: 'USD', minValue: 1000, maxValue: 2000 },
        { compensationType: 'salary', interval: '1 MONTH', currencyCode: 'EUR', minValue: 4000, maxValue: 5000 },
      ] },
    }] });

    // Act
    const job = ashby.normalize(body)?.jobs[0];

    // Assert
    expect(job?.salaryLabel).toBe('€4,000–€5,000 / month');
  });

  test('falls back to the summary text, then to the description text', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [
      { id: 'b1', title: 'A', jobUrl: 'u', descriptionHtml: '<p>Pay $70,000 - $80,000</p>', compensation: { scrapeableCompensationSalarySummary: '$50K - $60K' } },
      { id: 'b2', title: 'B', jobUrl: 'u', descriptionHtml: '<p>Pay $70,000 - $80,000</p>', compensation: { summaryComponents: [{ compensationType: 'Bonus', minValue: 1, maxValue: 2, currencyCode: 'USD' }] } },
      { id: 'b3', title: 'C', jobUrl: 'u', descriptionHtml: '<p>No pay stated</p>' },
    ] });

    // Act
    const jobs = ashby.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.salaryLabel)).toEqual(['$50K - $60K', '$70,000 - $80,000', undefined]);
  });

  test('skips a posting without an id or a title', () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ title: 'No id', jobUrl: 'u' }, { id: 'x', jobUrl: 'u' }, { id: 'ok', title: 'Ok', jobUrl: 'u' }] });

    // Act
    const jobs = ashby.normalize(body)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.id)).toEqual(['ok']);
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(ashby.normalize('{"jobs": []}')).toEqual({ company: undefined, jobs: [] });
  });

  test.each([
    '{"jobs": [{"id": 1, "absolute_url": "x"}]}',
    '{"jobs": {}}',
    '{}',
    'not json',
  ])('rejects %s', (body) => {
    // Act / Assert
    expect(ashby.normalize(body)).toBeNull();
  });
});
