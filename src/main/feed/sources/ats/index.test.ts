// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { atsSource, boardsInPage, isAtsLink, toItem } from './index';
import { fetchConditional, fetchText } from '../../../lib/fetch';
import { resolveSiteIcon } from '../siteIcon';

vi.mock(import('../../../lib/fetch'), () => ({ fetchConditional: vi.fn(), fetchText: vi.fn() }));
vi.mock(import('../siteIcon'), () => ({ resolveSiteIcon: vi.fn(), extractIconLinks: vi.fn() }));

const mockedFetchText = vi.mocked(fetchText);
const mockedFetchConditional = vi.mocked(fetchConditional);
const mockedIcon = vi.mocked(resolveSiteIcon);

const leverBody = JSON.stringify([
  { id: 'j1', text: 'Backend Engineer', hostedUrl: 'https://jobs.lever.co/acme/j1', createdAt: 1767225600000, categories: { location: 'Paris' }, workplaceType: 'remote', description: '<p>Hi</p>' },
  { id: 'j2', text: 'Designer', hostedUrl: 'https://jobs.lever.co/acme/j2', categories: {}, description: '' },
]);

const validators = { etag: '"v1"', last_modified: undefined };

beforeEach(() => {
  vi.resetAllMocks();
  mockedIcon.mockResolvedValue(undefined);
});

describe('toItem', () => {
  test('keeps the job title, links the hosted page and stores the card details in extra', () => {
    // Act
    const item = toItem(
      { id: '7', title: 'Engineer', url: 'https://x.test/7', html: '<p>Body</p>', publishedAt: '', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60k–€70k', department: 'Tech', employmentType: 'Full-time' },
      { provider: 'ashby' },
      'Acme',
    );

    // Assert
    expect(item).toEqual({
      title: 'Engineer', guid: 'ashby:7', link: 'https://x.test/7', pubDate: '', description: '<p>Body</p>', image: undefined, author: 'Acme', read_at: undefined,
      extra: JSON.stringify({ provider: 'ashby', company: 'Acme', location: 'Paris', workMode: 'hybrid', salaryLabel: '€60k–€70k', department: 'Tech', employmentType: 'Full-time' }),
    });
  });
});

describe('atsSource', () => {
  test('does not fetch full articles, since job pages are single-page apps', () => {
    // Act / Assert
    expect(atsSource.fetchesFullArticle).toBe(false);
    expect(atsSource.type).toBe('ats');
  });

  test('matches board links only, without the network', () => {
    // Act / Assert
    expect(atsSource.matches('https://jobs.lever.co/acme')).toBe(true);
    expect(atsSource.matches('https://example.com/careers')).toBe(false);
    expect(isAtsLink('https://api.lever.co/v0/postings/acme?mode=json')).toBe(true);
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('parses a body from any provider without a board', () => {
    // Act
    const parsed = atsSource.parse(leverBody);

    // Assert
    expect(parsed?.items.map((item) => item.title)).toEqual(['Backend Engineer', 'Designer']);
    expect(atsSource.parse('<html></html>')).toBeNull();
  });

  test('discovers a board from its link, titled with the company', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: leverBody, validators } });

    // Act
    const result = await atsSource.discover('https://jobs.lever.co/acme-corp');

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('https://api.lever.co/v0/postings/acme-corp?mode=json');
    expect(result).toMatchObject({ success: true, data: [{ type: 'ats', link: 'https://api.lever.co/v0/postings/acme-corp?mode=json', title: 'Acme Corp · Jobs' }] });
    expect(result.success && result.data[0]?.items).toHaveLength(2);
  });

  test('looks up the company icon when the jobs link to the company site', async () => {
    // Arrange
    const body = JSON.stringify({ jobs: [{ id: 1, title: 'Dev', absolute_url: 'https://careers.acme.com/detail/1', company_name: 'Acme', content: '' }] });
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators } });
    mockedIcon.mockResolvedValue('https://careers.acme.com/icon.png');

    // Act
    const result = await atsSource.discover('https://boards.greenhouse.io/acme');

    // Assert
    expect(mockedIcon).toHaveBeenCalledWith('https://careers.acme.com');
    expect(result).toMatchObject({ success: true, data: [{ title: 'Acme · Jobs', icon: 'https://careers.acme.com/icon.png', siteLink: 'https://careers.acme.com' }] });
  });

  test('finds the board behind a careers page and refuses private hosts for the page fetch', async () => {
    // Arrange
    const page = '<html><script src="https://boards.greenhouse.io/embed/job_board?for=acme&amp;x=1"></script><a href="https://jobs.lever.co/acme">Jobs</a></html>';
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://acme.test/careers'
        ? { success: true, data: { body: page, validators } }
        : url.includes('lever') ? { success: true, data: { body: leverBody, validators } } : { success: false, error: { name: 'NETWORK_ERROR', message: 'down' } },
    ));

    // Act
    const result = await atsSource.discover('acme.test/careers');

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('https://acme.test/careers', { blockPrivateHosts: true });
    expect(mockedFetchText).toHaveBeenCalledWith('https://api.lever.co/v0/postings/acme?mode=json', { blockPrivateHosts: true });
    expect(mockedFetchText).toHaveBeenCalledWith('https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true', { blockPrivateHosts: true });
    expect(result).toMatchObject({ success: true, data: [{ link: 'https://api.lever.co/v0/postings/acme?mode=json' }] });
    expect(result.success && result.data).toHaveLength(1);
  });

  test('explains when a page links to no supported board, or cannot be read', async () => {
    // Arrange
    mockedFetchText.mockResolvedValueOnce({ success: true, data: { body: '<html>nothing</html>', validators } });
    mockedFetchText.mockResolvedValueOnce({ success: false, error: { name: 'NETWORK_ERROR', message: 'down' } });

    // Act
    const empty = await atsSource.discover('https://acme.test/careers');
    const failed = await atsSource.discover('https://acme.test/careers');
    const bad = await atsSource.discover('   ');

    // Assert
    for (const result of [empty, failed, bad]) {
      expect(result).toMatchObject({ success: false, error: { name: 'UNSUPPORTED_FORMAT' } });
    }
  });

  test('titles a board after its slug when the ATS gives no company name', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: leverBody, validators } });

    // Act
    const result = await atsSource.discover('https://jobs.lever.co/acme--corp_labs');

    // Assert
    expect(result).toMatchObject({ success: true, data: [{ title: 'Acme Corp Labs · Jobs', description: 'Open positions at Acme Corp Labs.' }] });
  });

  test('refuses a body that belongs to another provider than the board', async () => {
    // Arrange
    const greenhouseBody = JSON.stringify({ jobs: [{ id: 1, title: 'Dev', absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', content: '' }] });
    mockedFetchText.mockResolvedValue({ success: true, data: { body: greenhouseBody, validators } });

    // Act
    const result = await atsSource.discover('https://jobs.lever.co/acme');

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'UNSUPPORTED_FORMAT' } });
  });

  test.each([
    ['https://careers.acme.com/jobs/1', 'https://careers.acme.com'],
    ['https://notlever.co/acme/1', 'https://notlever.co'],
    ['https://lever.co.example.com/acme/1', 'https://lever.co.example.com'],
    ['https://jobs.lever.co/acme/1', undefined],
    ['https://jobs.eu.lever.co/acme/1', undefined],
    ['https://lever.co/acme/1', undefined],
    ['https://boards.greenhouse.io/acme/jobs/1', undefined],
    ['https://acme.jobs.personio.de/job/1', undefined],
    ['https://jobs.smartrecruiters.com/Acme/1', undefined],
    [undefined, undefined],
  ])('reads the company site from the job link %s as %s', (hostedUrl, siteLink) => {
    // Arrange
    const body = JSON.stringify([{ id: 'j1', text: 'Dev', hostedUrl }]);

    // Act
    const parsed = atsSource.parse(body);

    // Assert
    expect(parsed?.siteLink).toBe(siteLink);
  });

  test('looks at no more than five boards of a careers page', async () => {
    // Arrange
    const links = [1, 2, 3, 4, 5, 6].map((n) => `<a href="https://jobs.lever.co/acme${n}">Jobs</a>`).join('');
    mockedFetchText.mockImplementation((url) => Promise.resolve({ success: true, data: { body: url === 'https://acme.test/careers' ? links : leverBody, validators } }));

    // Act
    const result = await atsSource.discover('https://acme.test/careers');

    // Assert
    expect(result.success && result.data.map((source) => source.link)).toEqual([1, 2, 3, 4, 5].map((n) => `https://api.lever.co/v0/postings/acme${n}?mode=json`));
    expect(mockedFetchText).toHaveBeenCalledTimes(6);
  });

  test('reads a careers page over plain http as well', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<html>nothing</html>', validators } });

    // Act
    await atsSource.discover('http://acme.test/careers');

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('http://acme.test/careers', { blockPrivateHosts: true });
  });

  test('matches a board link over plain http', () => {
    // Act / Assert
    expect(isAtsLink('http://jobs.lever.co/acme')).toBe(true);
  });

  test('reports an unreadable board body as unsupported', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<html>login</html>', validators } });

    // Act
    const result = await atsSource.discover('https://jobs.lever.co/acme');

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'UNSUPPORTED_FORMAT' } });
  });

  test('passes a fetch error through', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'too big' } });

    // Act
    const result = await atsSource.discover('https://jobs.lever.co/acme');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'too big' } });
  });

  test('refreshes a stored board with conditional GET and keeps the stored link', async () => {
    // Arrange
    mockedFetchConditional.mockResolvedValue({ success: true, data: { body: leverBody, validators } });
    const link = 'https://api.lever.co/v0/postings/acme?mode=json';

    // Act
    const result = await atsSource.fetch({ link, validators });

    // Assert
    expect(mockedFetchConditional).toHaveBeenCalledWith(link, { validators });
    expect(result).toMatchObject({ success: true, data: { validators, parsed: { type: 'ats', link, title: 'Acme · Jobs' } } });
  });

  test('passes a 304 through, and refuses a link that is not a board', async () => {
    // Arrange
    mockedFetchConditional.mockResolvedValue({ success: true, data: { notModified: true } });

    // Act
    const unchanged = await atsSource.fetch({ link: 'https://jobs.lever.co/acme', validators });
    const foreign = await atsSource.fetch({ link: 'https://example.com/feed' });

    // Assert
    expect(unchanged).toEqual({ success: true, data: { notModified: true } });
    expect(foreign).toMatchObject({ success: false, error: { name: 'UNSUPPORTED_FORMAT' } });
  });
});

describe('boardsInPage', () => {
  test('lists each board once, in page order, from links and embeds', () => {
    // Arrange
    const html = `<a href="https://jobs.ashbyhq.com/ramp">a</a> <a href="https://jobs.ashbyhq.com/ramp/123">b</a>
      <script>var u = "https://boards.greenhouse.io/embed/job_board?for=datadog"</script> <a href="https://example.com/x">c</a>`;

    // Act
    const boards = boardsInPage(html);

    // Assert
    expect(boards.map((board) => `${board.provider}:${board.slug}`)).toEqual(['ashby:ramp', 'greenhouse:datadog']);
  });

  test('decodes the ampersands of an attribute before it reads a board link', () => {
    // Arrange
    const html = '<script src="https://boards.greenhouse.io/embed/job_board?x=1&amp;for=acme"></script>';

    // Act
    const boards = boardsInPage(html);

    // Assert
    expect(boards.map((board) => board.slug)).toEqual(['acme']);
  });
});
