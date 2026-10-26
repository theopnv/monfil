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
  test('a profile URL maps to its feed', () => {
    // Act / Assert
    expect(blueskyCandidates('https://bsky.app/profile/bsky.app', false)).toEqual([{ link: 'https://bsky.app/profile/bsky.app/rss' }]);
    expect(blueskyCandidates('https://bsky.app/profile/jay.bsky.team/post/3abc', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
  });

  test('a handle with @ or a bsky.social handle resolves without the chip', () => {
    // Act / Assert
    expect(blueskyCandidates('@jay.bsky.team', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
    expect(blueskyCandidates('name.bsky.social', false)?.[0]?.link).toBe('https://bsky.app/profile/name.bsky.social/rss');
  });

  test('a custom-domain handle without @ needs the chip', () => {
    // Act / Assert
    expect(blueskyCandidates('example.com', true)?.[0]?.link).toBe('https://bsky.app/profile/example.com/rss');
    expect(blueskyCandidates('example.com', false)).toBeNull();
  });

  test('a profile URL with a malformed percent-encoding is rejected, not thrown', () => {
    // Act / Assert
    expect(blueskyCandidates('https://bsky.app/profile/%E0%A4%A', false)).toBeNull();
    expect(isBlueskyLink('https://bsky.app/profile/%E0%A4%A/rss')).toBe(false);
  });

  test('a profile URL whose actor is not a handle or a DID is rejected', () => {
    // Act / Assert
    expect(blueskyCandidates('https://bsky.app/profile/a%2Fb', false)).toBeNull();
    expect(blueskyCandidates('https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur', false)?.[0]?.link).toBe('https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/rss');
  });

  test('a Mastodon handle is not a Bluesky handle', () => {
    // Act / Assert
    expect(blueskyCandidates('@user@hachyderm.io', false)).toBeNull();
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

describe('blueskySource.parse', () => {
  test('gives title-less posts a title from their text', () => {
    // Arrange
    const feed = '<rss version="2.0"><channel><title>@bsky.app - Bluesky</title><item><link>https://bsky.app/profile/bsky.app/post/1</link><description>v1.135 is live!&#xA;&#xA;More text.</description><pubDate>16 Oct 2026 20:09 +0000</pubDate><guid isPermaLink="false">at://x/1</guid></item></channel></rss>';

    // Act
    const parsed = blueskySource.parse(feed);

    // Assert
    expect(parsed?.items[0]?.title).toBe('v1.135 is live!');
  });
});
