// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { PROVIDERS, toBoard } from './index';
import type { AtsProvider } from '../types';

vi.mock(import('../../../../lib/fetch'), () => ({ fetchText: vi.fn(), fetchConditional: vi.fn() }));

function adapter(provider: AtsProvider) {
  const found = PROVIDERS.find((candidate) => candidate.provider === provider);
  if (!found) {
    throw new Error(`No adapter for ${provider}`);
  }
  return found;
}

describe('toBoard', () => {
  test.each([
    ['https://boards.greenhouse.io/datadog', 'greenhouse', 'datadog', 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true'],
    ['https://job-boards.greenhouse.io/datadog/jobs/123', 'greenhouse', 'datadog', 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true'],
    ['https://boards.greenhouse.io/embed/job_board?for=datadog', 'greenhouse', 'datadog', 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true'],
    ['https://boards-api.greenhouse.io/v1/boards/datadog/jobs', 'greenhouse', 'datadog', 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true'],
    ['boards.greenhouse.io/datadog', 'greenhouse', 'datadog', 'https://boards-api.greenhouse.io/v1/boards/datadog/jobs?content=true'],
    ['https://jobs.lever.co/spotify', 'lever', 'spotify', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['http://jobs.lever.co/spotify', 'lever', 'spotify', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://jobs.eu.lever.co/acme/1234', 'lever', 'acme', 'https://api.eu.lever.co/v0/postings/acme?mode=json'],
    ['https://api.lever.co/v0/postings/spotify?mode=json', 'lever', 'spotify', 'https://api.lever.co/v0/postings/spotify?mode=json'],
    ['https://jobs.ashbyhq.com/ramp', 'ashby', 'ramp', 'https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true'],
    ['https://api.ashbyhq.com/posting-api/job-board/ramp', 'ashby', 'ramp', 'https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true'],
    ['https://apply.workable.com/huggingface/', 'workable', 'huggingface', 'https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true'],
    ['https://apply.workable.com/api/v1/widget/accounts/huggingface', 'workable', 'huggingface', 'https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true'],
    ['https://jobs.smartrecruiters.com/BoschGroup', 'smartrecruiters', 'BoschGroup', 'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings?limit=100'],
    ['https://api.smartrecruiters.com/v1/companies/BoschGroup/postings', 'smartrecruiters', 'BoschGroup', 'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings?limit=100'],
    ['https://bunq.recruitee.com/', 'recruitee', 'bunq', 'https://bunq.recruitee.com/api/offers/'],
    ['https://tradera.teamtailor.com/jobs', 'teamtailor', 'tradera', 'https://tradera.teamtailor.com/jobs.rss'],
    ['https://personio.jobs.personio.com/', 'personio', 'personio', 'https://personio.jobs.personio.com/xml'],
    ['https://acme.jobs.personio.de/job/42', 'personio', 'acme', 'https://acme.jobs.personio.de/xml'],
  ] as const)('maps %s to a %s board', (link, provider, slug, apiUrl) => {
    // Act
    const board = toBoard(link);

    // Assert
    expect(board).toMatchObject({ provider, slug, apiUrl });
  });

  test.each([
    ['https://boards.greenhouse.io/a%20b', 'https://boards-api.greenhouse.io/v1/boards/a%20b/jobs?content=true'],
    ['https://boards-api.greenhouse.io/v1/boards/a%20b/jobs', 'https://boards-api.greenhouse.io/v1/boards/a%20b/jobs?content=true'],
    ['https://jobs.lever.co/a%20b', 'https://api.lever.co/v0/postings/a%20b?mode=json'],
    ['https://api.lever.co/v0/postings/a%20b', 'https://api.lever.co/v0/postings/a%20b?mode=json'],
    ['https://jobs.ashbyhq.com/a%20b', 'https://api.ashbyhq.com/posting-api/job-board/a%20b?includeCompensation=true'],
    ['https://api.ashbyhq.com/posting-api/job-board/a%20b', 'https://api.ashbyhq.com/posting-api/job-board/a%20b?includeCompensation=true'],
    ['https://apply.workable.com/a%20b/', 'https://apply.workable.com/api/v1/widget/accounts/a%20b?details=true'],
    ['https://apply.workable.com/api/v1/widget/accounts/a%20b', 'https://apply.workable.com/api/v1/widget/accounts/a%20b?details=true'],
    ['https://www.workable.com/api/accounts/a%20b', 'https://apply.workable.com/api/v1/widget/accounts/a%20b?details=true'],
    ['https://jobs.smartrecruiters.com/a%20b', 'https://api.smartrecruiters.com/v1/companies/a%20b/postings?limit=100'],
    ['https://api.smartrecruiters.com/v1/companies/a%20b/postings', 'https://api.smartrecruiters.com/v1/companies/a%20b/postings?limit=100'],
  ])('reads the escaped slug of %s and escapes it once in the API link', (link, apiUrl) => {
    // Act
    const board = toBoard(link);

    // Assert
    expect(board).toMatchObject({ slug: 'a b', apiUrl });
  });

  test.each([
    'https://example.com/jobs',
    'https://jobs.lever.co/%E0%A4%A',
    'https://boards.greenhouse.io/',
    'https://boards.greenhouse.io/embed',
    'https://jobs.lever.co/',
    'https://api.lever.co/v0/other/x',
    'https://apply.workable.com/j/ABC123',
    'https://www.recruitee.com/',
    'https://www.teamtailor.com/',
    'https://foo.bar.recruitee.com/',
    'https://jobs.personio.com/',
    'ftp://jobs.lever.co/spotify',
    'not a url at all',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(toBoard(link)).toBeNull();
  });

  test('keeps the filters of a SmartRecruiters API link, so a large employer can be narrowed', () => {
    // Act
    const board = toBoard('https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?country=fr&limit=5&utm=x');

    // Assert
    expect(board?.apiUrl).toBe('https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?limit=100&country=fr');
  });

  test('keeps the board origin of a Personio board for its job links', () => {
    // Act / Assert
    expect(toBoard('https://acme.jobs.personio.de/')?.origin).toBe('https://acme.jobs.personio.de');
  });
});

describe('greenhouse', () => {
  const body = JSON.stringify({ jobs: [
    {
      id: 101, title: 'Data Analyst', absolute_url: 'https://boards.greenhouse.io/acme/jobs/101', company_name: 'Acme', first_published: '2026-01-05T10:00:00-05:00',
      updated_at: '2026-10-01T00:00:00Z', location: { name: 'Paris (Hybrid)' }, departments: [{ name: 'Data' }],
      content: '&lt;p&gt;Pay: $90,000 &amp;mdash; $110,000&lt;/p&gt;', metadata: [{ name: 'Employment Type', value: 'Full time' }],
    },
    { id: 102, title: 'Designer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/102', location: { name: 'Remote' }, pay_input_ranges: [{ min_cents: 5000000, max_cents: 7000000, currency_type: 'EUR' }], content: '' },
    { title: 'No id', absolute_url: 'x' },
  ] });

  test('reads jobs, decodes the escaped description and uses the first publication date', () => {
    // Act
    const listing = adapter('greenhouse').normalize(body);

    // Assert
    expect(listing?.company).toBe('Acme');
    expect(listing?.jobs).toHaveLength(2);
    expect(listing?.jobs[0]).toMatchObject({
      id: '101', title: 'Data Analyst', url: 'https://boards.greenhouse.io/acme/jobs/101', html: '<p>Pay: $90,000 &mdash; $110,000</p>',
      publishedAt: '2026-01-05T15:00:00.000Z', location: 'Paris (Hybrid)', workMode: 'hybrid', salaryLabel: '$90,000 — $110,000', department: 'Data', employmentType: 'Full time',
    });
  });

  test('leaves the date empty without first_published and prefers structured pay', () => {
    // Act
    const job = adapter('greenhouse').normalize(body)?.jobs[1];

    // Assert
    expect(job).toMatchObject({ publishedAt: '', workMode: 'remote', salaryLabel: '€50,000–€70,000 / year' });
  });

  test.each(['not json', '{}', '{"jobs": [{"id": 1, "title": "x", "jobUrl": "y"}]}', '[]'])('rejects %s', (input) => {
    // Act / Assert
    expect(adapter('greenhouse').normalize(input)).toBeNull();
  });

  test('accepts an empty board', () => {
    // Act / Assert
    expect(adapter('greenhouse').normalize('{"jobs": []}')).toEqual({ company: undefined, jobs: [] });
  });
});

describe('lever', () => {
  const body = JSON.stringify([
    {
      id: 'abc', text: 'Backend Engineer', hostedUrl: 'https://jobs.lever.co/acme/abc', createdAt: 1767225600000, workplaceType: 'hybrid',
      categories: { location: 'Paris', team: 'Platform', department: 'Engineering', commitment: 'Full-time' },
      description: '<div>Intro</div>', lists: [{ text: 'You will', content: '<li>Build</li>' }], additional: '<p>Equal opportunity</p>',
      salaryRange: { currency: 'EUR', interval: 'per-year-salary', min: 60000, max: 80000 },
    },
    { id: 'def', text: 'Sales', hostedUrl: 'https://jobs.lever.co/acme/def', categories: { allLocations: ['Lyon', 'Remote'] }, descriptionPlain: '', salaryDescriptionPlain: 'Base €40k–€50k' },
  ]);

  test('reads jobs with structured pay, lists and ms dates', () => {
    // Act
    const jobs = adapter('lever').normalize(body)?.jobs;

    // Assert
    expect(jobs?.[0]).toMatchObject({
      id: 'abc', title: 'Backend Engineer', url: 'https://jobs.lever.co/acme/abc', publishedAt: '2026-01-01T00:00:00.000Z', location: 'Paris', workMode: 'hybrid',
      salaryLabel: '€60,000–€80,000 / year', department: 'Engineering', employmentType: 'Full-time',
      html: '<div>Intro</div><h3>You will</h3><ul><li>Build</li></ul><p>Equal opportunity</p>',
    });
  });

  test('falls back to all locations and to the salary text', () => {
    // Act
    const job = adapter('lever').normalize(body)?.jobs[1];

    // Assert
    expect(job).toMatchObject({ location: 'Lyon, Remote', workMode: 'remote', salaryLabel: '€40k–€50k', publishedAt: '' });
  });

  test.each(['{}', '[{"id": 1}]', 'nope'])('rejects %s', (input) => {
    // Act / Assert
    expect(adapter('lever').normalize(input)).toBeNull();
  });
});

describe('ashby', () => {
  const body = JSON.stringify({ jobs: [
    {
      id: 'a1', title: ' Analytics Engineer ', department: 'Data', team: 'BI', employmentType: 'FullTime', location: 'Paris', workplaceType: 'OnSite', publishedAt: '2026-03-01T09:00:00.000+00:00',
      jobUrl: 'https://jobs.ashbyhq.com/acme/a1', descriptionHtml: '<p>Hello</p>',
      compensation: { summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 100000, maxValue: 130000 }] },
    },
    { id: 'a2', title: 'Support', isRemote: true, jobUrl: 'https://jobs.ashbyhq.com/acme/a2', compensation: { scrapeableCompensationSalarySummary: '$50K - $60K' } },
  ] });

  test('reads jobs with structured compensation', () => {
    // Act
    const jobs = adapter('ashby').normalize(body)?.jobs;

    // Assert
    expect(jobs?.[0]).toMatchObject({
      id: 'a1', title: 'Analytics Engineer', workMode: 'on-site', salaryLabel: '$100,000–$130,000 / year', department: 'Data', employmentType: 'FullTime',
      publishedAt: '2026-03-01T09:00:00.000Z', html: '<p>Hello</p>',
    });
  });

  test('uses isRemote and the summary text when there is no structured pay', () => {
    // Act
    const job = adapter('ashby').normalize(body)?.jobs[1];

    // Assert
    expect(job).toMatchObject({ workMode: 'remote', salaryLabel: '$50K - $60K', html: '' });
  });

  test('rejects a Greenhouse-shaped body', () => {
    // Act / Assert
    expect(adapter('ashby').normalize('{"jobs": [{"id": 1, "absolute_url": "x"}]}')).toBeNull();
  });
});

describe('workable', () => {
  const body = JSON.stringify({ name: 'Acme', jobs: [
    { title: 'ML Engineer', shortcode: 'AAA', url: 'https://apply.workable.com/j/AAA', published_on: '2026-05-29', city: 'Paris', state: 'Île-de-France', country: 'France', telecommuting: true, department: 'AI', employment_type: 'Full-time', description: '<p>Pay €70k-€90k</p>' },
    { title: 'Office Manager', shortcode: 'BBB', shortlink: 'https://apply.workable.com/j/BBB', created_at: '2026-02-01', description: '' },
  ] });

  test('reads jobs and the company name', () => {
    // Act
    const listing = adapter('workable').normalize(body);

    // Assert
    expect(listing?.company).toBe('Acme');
    expect(listing?.jobs[0]).toMatchObject({ id: 'AAA', location: 'Paris, Île-de-France, France', workMode: 'remote', salaryLabel: '€70k-€90k', publishedAt: '2026-05-29T00:00:00.000Z', department: 'AI' });
    expect(listing?.jobs[1]).toMatchObject({ url: 'https://apply.workable.com/j/BBB', publishedAt: '2026-02-01T00:00:00.000Z' });
  });

  test('rejects a body without jobs', () => {
    // Act / Assert
    expect(adapter('workable').normalize('{"name": "x"}')).toBeNull();
  });
});

describe('smartrecruiters', () => {
  const body = JSON.stringify({ totalFound: 2, content: [
    {
      id: '7440', uuid: 'u1', name: 'Consultant', company: { identifier: 'BoschGroup', name: 'Bosch Group' }, releasedDate: '2026-10-23T09:41:48.407Z',
      location: { city: 'Paris', country: 'fr', fullLocation: 'Paris, France', remote: false, hybrid: true }, department: { label: 'Consulting' }, typeOfEmployment: { label: 'Full-time' },
    },
    { id: '7441', uuid: 'u2', name: 'Analyst', company: { name: 'Bosch Group' }, location: { city: 'Lyon', country: 'fr' }, function: { label: 'IT' } },
  ] });

  test('builds the job link and a short summary, since the list has no posting text', () => {
    // Act
    const listing = adapter('smartrecruiters').normalize(body);

    // Assert
    expect(listing?.company).toBe('Bosch Group');
    expect(listing?.jobs[0]).toMatchObject({
      url: 'https://jobs.smartrecruiters.com/BoschGroup/7440', html: '<p>Consulting · Full-time · Paris, France</p>', workMode: 'hybrid', salaryLabel: undefined, publishedAt: '2026-10-23T09:41:48.407Z',
    });
    expect(listing?.jobs[1]).toMatchObject({ url: undefined, location: 'Lyon, FR', department: 'IT' });
  });

  test('rejects a body without content', () => {
    // Act / Assert
    expect(adapter('smartrecruiters').normalize('{"jobs": []}')).toBeNull();
  });
});

describe('recruitee', () => {
  const body = JSON.stringify({ offers: [
    {
      id: 1, title: 'Product Manager', company_name: 'bunq', careers_url: 'https://careers.bunq.com/o/pm', published_at: '2026-10-15 09:31:36 UTC', location: 'Amsterdam, Netherlands',
      hybrid: true, department: 'Product', employment_type_code: 'fulltime_permanent', description: '<p>About</p>', requirements: '<ul><li>SQL</li></ul>', salary: { min: 5000, max: 6000, currency: 'EUR', period: 'month' },
    },
    { id: 2, title: 'Intern', careers_url: 'https://careers.bunq.com/o/intern', city: 'Sofia', country: 'Bulgaria', remote: true },
  ] });

  test('reads offers, joins requirements and parses the UTC date', () => {
    // Act
    const listing = adapter('recruitee').normalize(body);

    // Assert
    expect(listing?.company).toBe('bunq');
    expect(listing?.jobs[0]).toMatchObject({
      publishedAt: '2026-10-15T09:31:36.000Z', workMode: 'hybrid', salaryLabel: '€5,000–€6,000 / month', html: '<p>About</p><h3>Requirements</h3><ul><li>SQL</li></ul>', employmentType: 'fulltime_permanent',
    });
    expect(listing?.jobs[1]).toMatchObject({ location: 'Sofia, Bulgaria', workMode: 'remote' });
  });

  test('rejects a body without offers', () => {
    // Act / Assert
    expect(adapter('recruitee').normalize('{}')).toBeNull();
  });
});

describe('teamtailor', () => {
  const body = `<?xml version="1.0"?><rss version="2.0" xmlns:tt="https://teamtailor.com/locations"><channel><title>Tradera</title>
    <item><title>Commercial Lead &amp; Co</title><description>&lt;p&gt;Pay $90,000 - $100,000&lt;/p&gt;</description><pubDate>Mon, 17 Aug 2026 13:18:38 +0200</pubDate>
      <link>https://careers.tradera.com/jobs/1</link><remoteStatus>hybrid</remoteStatus><guid>g-1</guid>
      <tt:locations><tt:location><tt:name>HQ</tt:name><tt:city>Stockholm</tt:city><tt:country>Sweden</tt:country></tt:location></tt:locations><tt:department>Marketing</tt:department></item>
    <item><title>Dev</title><link>https://careers.tradera.com/jobs/2</link><description></description><remoteStatus>none</remoteStatus><tt:locations>
    </tt:locations></item></channel></rss>`;

  test('reads items with their Teamtailor fields', () => {
    // Act
    const listing = adapter('teamtailor').normalize(body);

    // Assert
    expect(listing?.company).toBe('Tradera');
    expect(listing?.jobs[0]).toMatchObject({
      id: 'g-1', title: 'Commercial Lead & Co', url: 'https://careers.tradera.com/jobs/1', html: '<p>Pay $90,000 - $100,000</p>', publishedAt: '2026-08-17T11:18:38.000Z',
      location: 'Stockholm, Sweden', workMode: 'hybrid', salaryLabel: '$90,000 - $100,000', department: 'Marketing',
    });
    expect(listing?.jobs[1]).toMatchObject({ id: 'https://careers.tradera.com/jobs/2', location: undefined, workMode: 'on-site', publishedAt: '' });
  });

  test('rejects a plain RSS feed', () => {
    // Act / Assert
    expect(adapter('teamtailor').normalize('<rss version="2.0"><channel><title>Blog</title></channel></rss>')).toBeNull();
  });
});

describe('personio', () => {
  const body = `<?xml version="1.0"?><workzag-jobs><position><id>12</id><subcompany>Acme GmbH</subcompany><office>Munich</office>
    <additionalOffices><office>Berlin</office></additionalOffices><department>Tech</department><name>Engineer &amp; Lead</name>
    <jobDescriptions><jobDescription><name>The Role</name><value><![CDATA[<p>Hybrid role, 60.000 € - 70.000 € per year</p>]]></value></jobDescription></jobDescriptions>
    <employmentType>permanent</employmentType><schedule>full-time</schedule><createdAt>2024-11-13T14:10:41+00:00</createdAt></position>
    <position><id>13</id><name>Intern</name><jobDescriptions></jobDescriptions></position></workzag-jobs>`;

  test('reads positions and builds the job link from the board origin', () => {
    // Arrange
    const board = toBoard('https://acme.jobs.personio.de/') ?? undefined;

    // Act
    const listing = adapter('personio').normalize(body, board);

    // Assert
    expect(listing?.company).toBe('Acme GmbH');
    expect(listing?.jobs[0]).toMatchObject({
      id: '12', title: 'Engineer & Lead', url: 'https://acme.jobs.personio.de/job/12', html: '<h3>The Role</h3><p>Hybrid role, 60.000 € - 70.000 € per year</p>',
      publishedAt: '2024-11-13T14:10:41.000Z', location: 'Munich, Berlin', workMode: 'hybrid', salaryLabel: '60.000 € - 70.000 € / year', department: 'Tech', employmentType: 'full-time · permanent',
    });
    expect(listing?.jobs[1]).toMatchObject({ id: '13', html: '', url: 'https://acme.jobs.personio.de/job/13' });
  });

  test('leaves the link empty without a board, and rejects other XML', () => {
    // Act / Assert
    expect(adapter('personio').normalize(body)?.jobs[0]?.url).toBeUndefined();
    expect(adapter('personio').normalize('<feed/>')).toBeNull();
  });
});
