import { afterEach, describe, expect, it, vi } from 'vitest';
import { upload, uploadTarget } from './upload.mts';

const SNAPSHOT = { sha: 'a'.repeat(40), date: '2026-10-21T00:00:00Z', functions: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadTarget', () => {
  it('drops a trailing slash from the URL', () => {
    // Act
    const result = uploadTarget({ COMPLEXITY_WORKER_URL: 'https://worker.test/', COMPLEXITY_INGEST_TOKEN: 't' });

    // Assert
    expect(result).toEqual({ url: 'https://worker.test', token: 't' });
  });

  it('fails when the token is missing', () => {
    // Act
    const read = () => uploadTarget({ COMPLEXITY_WORKER_URL: 'https://worker.test' });

    // Assert
    expect(read).toThrow('COMPLEXITY_INGEST_TOKEN');
  });
});

describe('upload', () => {
  it('posts the snapshot to /ingest with the bearer token', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response('{"functions":0}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const result = await upload({ url: 'https://worker.test', token: 'secret' }, SNAPSHOT);

    // Assert
    expect(result).toEqual({ functions: 0 });
    expect(fetchMock).toHaveBeenCalledWith('https://worker.test/ingest', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      body: JSON.stringify(SNAPSHOT),
    }));
  });

  it('fails with the status and body when the Worker refuses the snapshot', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"unauthorized"}', { status: 401 })));

    // Act
    const send = upload({ url: 'https://worker.test', token: 'wrong' }, SNAPSHOT);

    // Assert
    await expect(send).rejects.toThrow('failed with 401: {"error":"unauthorized"}');
  });
});
