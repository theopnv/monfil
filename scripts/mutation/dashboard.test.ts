import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportUrl, uploadReport } from './dashboard.mts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reportUrl', () => {
  it('puts the suite in the module and encodes a branch with a slash', () => {
    // Act
    const url = reportUrl('ci/mutation-testing', 'unit');

    // Assert
    expect(url).toBe('https://dashboard.stryker-mutator.io/api/reports/github.com/theopnv/monfil/ci%2Fmutation-testing?module=unit');
  });
});

describe('uploadReport', () => {
  it('puts the report with the API key and gives the page address', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response('{"href":"https://dashboard.stryker-mutator.io/reports/x"}'));
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const href = await uploadReport('{"files":{}}', 'main', 'unit', 'key');

    // Assert
    expect(href).toBe('https://dashboard.stryker-mutator.io/reports/x');
    expect(fetchMock).toHaveBeenCalledWith(reportUrl('main', 'unit'), {
      method: 'PUT',
      headers: { 'X-Api-Key': 'key', 'Content-Type': 'application/json' },
      body: '{"files":{}}',
    });
  });

  it('names the API key when the dashboard refuses it', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));

    // Act
    const upload = uploadReport('{}', 'main', 'unit', 'bad');

    // Assert
    await expect(upload).rejects.toThrow('STRYKER_DASHBOARD_API_KEY');
  });
});
