// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { personio } from './personio';

const feed = (positions: string) => `<?xml version="1.0"?><workzag-jobs>${positions}</workzag-jobs>`;
const board = { provider: 'personio', slug: 'acme', apiUrl: 'https://acme.jobs.personio.de/xml', origin: 'https://acme.jobs.personio.de' } as const;

describe('personio toBoard', () => {
  test.each([
    ['https://acme.jobs.personio.com/', 'com'],
    ['https://acme.jobs.personio.com/job/42', 'com'],
    ['https://acme.jobs.personio.de/xml', 'de'],
    ['https://ACME.jobs.personio.de/', 'de'],
  ])('maps %s to the acme board on .%s', (link, tld) => {
    // Act
    const found = personio.toBoard(new URL(link));

    // Assert
    expect(found).toEqual({ provider: 'personio', slug: 'acme', apiUrl: `https://acme.jobs.personio.${tld}/xml`, origin: `https://acme.jobs.personio.${tld}` });
  });

  test('accepts a slug with digits and hyphens', () => {
    // Act / Assert
    expect(personio.toBoard(new URL('https://acme-2.jobs.personio.de/'))?.slug).toBe('acme-2');
  });

  test.each([
    'https://jobs.personio.com/',
    'https://jobs.personio.de/',
    'https://personio.com/',
    'https://acme.personio.de/',
    'https://acme.jobs.personio.fr/',
    'https://acme.jobs.personio.org/',
    'https://a.b.jobs.personio.de/',
    'https://acme.jobs.personio.de.example.com/',
    'https://xacme.jobs.personio.de.evil.test/',
    'https://acme_corp.jobs.personio.de/',
    'https://acme.jobs.personio/',
    'https://acme.jobs.personio.comx/',
    'https://example.com/',
  ])('does not map %s', (link) => {
    // Act / Assert
    expect(personio.toBoard(new URL(link))).toBeNull();
  });
});

describe('personio normalize', () => {
  test('maps a position with every field to a job', () => {
    // Arrange
    const body = feed(`<position><id>12</id><subcompany>Acme GmbH</subcompany><office>Munich</office>
      <additionalOffices><office>Berlin</office><office>Munich</office></additionalOffices><department>Tech</department><recruitingCategory>Eng</recruitingCategory><name>Engineer &amp; Lead</name>
      <jobDescriptions><jobDescription><name>The &amp; Role</name><value><![CDATA[<p>Hybrid role, 60.000 € - 70.000 € per year</p>]]></value></jobDescription>
      <jobDescription><name>Team</name><value><![CDATA[<p>Nice</p>]]></value></jobDescription></jobDescriptions>
      <employmentType>permanent</employmentType><schedule>full-time</schedule><createdAt>2024-11-13T14:10:41+00:00</createdAt></position>`);

    // Act
    const listing = personio.normalize(body, board);

    // Assert
    expect(listing).toEqual({
      company: 'Acme GmbH',
      jobs: [{
        id: '12', title: 'Engineer & Lead', url: 'https://acme.jobs.personio.de/job/12', html: '<h3>The &amp; Role</h3><p>Hybrid role, 60.000 € - 70.000 € per year</p><h3>Team</h3><p>Nice</p>',
        publishedAt: '2024-11-13T14:10:41.000Z', location: 'Munich, Berlin', workMode: 'hybrid', salaryLabel: '60.000 € - 70.000 € / year', department: 'Tech', employmentType: 'full-time · permanent',
      }],
    });
  });

  test('leaves absent fields empty, and uses the recruiting category when there is no department', () => {
    // Arrange
    const body = feed('<position><id>13</id><name>Intern</name><recruitingCategory>Students</recruitingCategory></position>');

    // Act
    const listing = personio.normalize(body, board);

    // Assert
    expect(listing?.jobs).toEqual([{
      id: '13', title: 'Intern', url: 'https://acme.jobs.personio.de/job/13', html: '', publishedAt: '', location: undefined, workMode: undefined,
      salaryLabel: undefined, department: 'Students', employmentType: undefined,
    }]);
  });

  test('builds the description from the sections that have a name or a value', () => {
    // Arrange
    const body = feed(`<position><id>1</id><name>A</name><jobDescriptions>
      <jobDescription><value><![CDATA[<p>No name</p>]]></value></jobDescription>
      <jobDescription><name>No value</name></jobDescription></jobDescriptions></position>`);

    // Act
    const job = personio.normalize(body, board)?.jobs[0];

    // Assert
    expect(job?.html).toBe('<p>No name</p><h3>No value</h3>');
  });

  test('reads the work mode from the start of the description only', () => {
    // Arrange
    const filler = `<p>${'We build tools. '.repeat(30)}</p>`;
    const body = feed(`<position><id>1</id><name>Near</name><jobDescriptions><jobDescription><name>Role</name><value><![CDATA[<p>Remote first.</p>]]></value></jobDescription></jobDescriptions></position>
      <position><id>2</id><name>Far</name><jobDescriptions><jobDescription><name>Role</name><value><![CDATA[${filler}<p>Remote first.</p>]]></value></jobDescription></jobDescriptions></position>`);

    // Act
    const jobs = personio.normalize(body, board)?.jobs;

    // Assert
    expect(jobs?.map((job) => job.workMode)).toEqual(['remote', undefined]);
  });

  test('leaves the link empty without a board origin', () => {
    // Arrange
    const body = feed('<position><id>1</id><name>A</name></position>');

    // Act / Assert
    expect(personio.normalize(body)?.jobs[0]?.url).toBeUndefined();
    expect(personio.normalize(body, { provider: 'personio', slug: 'acme', apiUrl: 'x' })?.jobs[0]?.url).toBeUndefined();
  });

  test('skips a position without an id or a name', () => {
    // Arrange
    const body = feed('<position><name>No id</name></position><position><id>2</id></position><position><id>3</id><name>Ok</name></position>');

    // Act
    const listing = personio.normalize(body, board);

    // Assert
    expect(listing?.jobs.map((job) => job.id)).toEqual(['3']);
  });

  test('accepts a feed without positions', () => {
    // Act / Assert
    expect(personio.normalize(feed(''))).toEqual({ company: undefined, jobs: [] });
  });

  test.each(['<feed/>', '', 'not xml', '<workzag/>'])('rejects %j', (body) => {
    // Act / Assert
    expect(personio.normalize(body)).toBeNull();
  });
});
