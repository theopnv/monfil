// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchText, type FetchTextResult } from '../../lib/fetch';
import { blueskyCandidates, blueskySource, isBlueskyLink } from './bluesky';

vi.mock(import('../../lib/fetch'), () => ({
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);

afterEach(() => {
  mockedFetchText.mockReset();
});

describe('blueskyCandidates', () => {

  test('a handle with @ or a bsky.social handle resolves without the chip', () => {
    // Act / Assert
    expect(blueskyCandidates('@jay.bsky.team', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
    expect(blueskyCandidates('name.bsky.social', false)?.[0]?.link).toBe('https://bsky.app/profile/name.bsky.social/rss');
  });

  test('a profile URL whose actor is a handle with an encoded @ is rejected', () => {
    // Act / Assert
    expect(blueskyCandidates('https://bsky.app/profile/%40jay.bsky.team', false)).toBeNull();
  });

  test('ignores the spaces around a handle', () => {
    // Act / Assert
    expect(blueskyCandidates('  @jay.bsky.team  ', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
  });
});

describe('isBlueskyLink', () => {
  test('detects profile URLs and handles', () => {
    // Act / Assert
    expect(isBlueskyLink('https://bsky.app/profile/bsky.app')).toBe(true);
    expect(isBlueskyLink('@jay.bsky.team')).toBe(true);
    expect(isBlueskyLink('https://example.com/')).toBe(false);
  });

  test('does not take a bare custom-domain name for a handle', () => {
    // Act / Assert
    expect(isBlueskyLink('example.com')).toBe(false);
  });
});

describe('blueskySource.discover', () => {
  const feedBody = '<rss version="2.0"><channel><title>@jay.bsky.team - Bluesky</title></channel></rss>';
  const ok = (body: string): FetchTextResult => ({ success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } });

  function serve(responses: Record<string, FetchTextResult>): void {
    mockedFetchText.mockImplementation(async (url) => responses[url] ?? { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404' } });
  }

  test('uses the avatar of the profile as the icon', async () => {
    // Arrange
    serve({
      'https://bsky.app/profile/jay.bsky.team/rss': ok(feedBody),
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=jay.bsky.team': ok(JSON.stringify({ avatar: 'https://cdn.bsky.app/img/avatar/jay.jpg' })),
    });

    // Act
    const result = await blueskySource.discover('@jay.bsky.team');

    // Assert
    expect(result.success && result.data.map((source) => [source.link, source.icon])).toEqual([
      ['https://bsky.app/profile/jay.bsky.team/rss', 'https://cdn.bsky.app/img/avatar/jay.jpg'],
    ]);
  });

  test('asks for the profile of a DID with its colons encoded', async () => {
    // Arrange
    serve({
      'https://bsky.app/profile/did:plc:abc123/rss': ok(feedBody),
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Aabc123': ok(JSON.stringify({ avatar: 'https://cdn.bsky.app/img/avatar/did.jpg' })),
    });

    // Act
    const result = await blueskySource.discover('https://bsky.app/profile/did:plc:abc123');

    // Assert
    expect(result.success && result.data[0]?.icon).toBe('https://cdn.bsky.app/img/avatar/did.jpg');
  });
});
