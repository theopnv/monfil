// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchText, type FetchTextResult } from '../../lib/fetch';
import { gitlabCandidates, gitlabSource, isGitlabLink } from './gitlab';

vi.mock(import('../../lib/fetch'), () => ({
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);

afterEach(() => {
  mockedFetchText.mockReset();
});

describe('gitlabCandidates', () => {
  test('a project URL offers its releases feed', () => {
    // Act
    const candidates = gitlabCandidates('https://gitlab.com/gitlab-org/gitlab', false);

    // Assert
    expect(candidates).toEqual([{ link: 'https://gitlab.com/gitlab-org/gitlab/-/releases.atom', label: 'Releases' }]);
  });

  test('a nested project URL with a page suffix keeps the full project path', () => {
    // Act
    const candidates = gitlabCandidates('https://gitlab.com/gitlab-org/cli/sub/tool/-/merge_requests/4', false);

    // Assert
    expect(candidates?.[0]?.link).toBe('https://gitlab.com/gitlab-org/cli/sub/tool/-/releases.atom');
  });

  test('a stored feed URL is kept as it is', () => {
    // Act
    const candidates = gitlabCandidates('https://gitlab.com/gitlab-org/gitlab/-/releases.atom', false);

    // Assert
    expect(candidates?.[0]?.link).toBe('https://gitlab.com/gitlab-org/gitlab/-/releases.atom');
  });

  test('a self-hosted instance resolves only when the GitLab chip is picked', () => {
    // Act
    const withChip = gitlabCandidates('https://gitlab.gnome.org/GNOME/gtk', true);
    const withoutChip = gitlabCandidates('https://gitlab.gnome.org/GNOME/gtk', false);

    // Assert
    expect(withChip?.[0]?.link).toBe('https://gitlab.gnome.org/GNOME/gtk/-/releases.atom');
    expect(withoutChip).toBeNull();
  });

  test('a single path segment is not a project', () => {
    // Act / Assert
    expect(gitlabCandidates('https://gitlab.com/gitlab-org', false)).toBeNull();
  });

  test('a stored feed URL is kept as it is, without a label or a query', () => {
    // Act
    const candidates = gitlabCandidates('https://git.example.org/team/tool/-/releases.atom?feed_token=abc', true);

    // Assert
    expect(candidates).toEqual([{ link: 'https://git.example.org/team/tool/-/releases.atom' }]);
  });

  test('a path segment with a character a project name cannot hold is not a project', () => {
    // Act / Assert
    expect(gitlabCandidates('https://gitlab.com/gitlab-org/bad%20name', false)).toBeNull();
  });

  test('".git" is cut only from the end of a project name', () => {
    // Act
    const clone = gitlabCandidates('https://gitlab.com/team/tool.git', false);
    const pages = gitlabCandidates('https://gitlab.com/team/team.github.io', false);

    // Assert
    expect(clone?.[0]?.link).toBe('https://gitlab.com/team/tool/-/releases.atom');
    expect(pages?.[0]?.link).toBe('https://gitlab.com/team/team.github.io/-/releases.atom');
  });
});

describe('gitlabSource.discover', () => {
  const feedBody = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Releases</title><id>feed</id></feed>';

  function serve(responses: Record<string, FetchTextResult>): void {
    mockedFetchText.mockImplementation(async (url) => responses[url] ?? { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404' } });
  }

  const ok = (body: string): FetchTextResult => ({ success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } });

  test('uses the avatar of the project as the icon, asking the API for the encoded project path', async () => {
    // Arrange
    serve({
      'https://gitlab.com/team/sub/tool/-/releases.atom': ok(feedBody),
      'https://gitlab.com/api/v4/projects/team%2Fsub%2Ftool': ok(JSON.stringify({ avatar_url: 'https://gitlab.com/uploads/tool.png', namespace: { avatar_url: 'https://gitlab.com/uploads/team.png' } })),
    });

    // Act
    const result = await gitlabSource.discover('https://gitlab.com/team/sub/tool');

    // Assert
    expect(result.success && result.data.map((source) => [source.link, source.icon])).toEqual([
      ['https://gitlab.com/team/sub/tool/-/releases.atom', 'https://gitlab.com/uploads/tool.png'],
    ]);
  });

  test('falls back to the avatar of the namespace when the project has none', async () => {
    // Arrange
    serve({
      'https://gitlab.com/team/tool/-/releases.atom': ok(feedBody),
      'https://gitlab.com/api/v4/projects/team%2Ftool': ok(JSON.stringify({ avatar_url: null, namespace: { avatar_url: 'https://gitlab.com/uploads/team.png' } })),
    });

    // Act
    const result = await gitlabSource.discover('https://gitlab.com/team/tool');

    // Assert
    expect(result.success && result.data[0]?.icon).toBe('https://gitlab.com/uploads/team.png');
  });

  test('resolves an avatar path against the origin of a self-hosted instance', async () => {
    // Arrange
    serve({
      'https://git.example.org/team/tool/-/releases.atom': ok(feedBody),
      'https://git.example.org/api/v4/projects/team%2Ftool': ok(JSON.stringify({ avatar_url: '/uploads/-/system/project/avatar/1/tool.png' })),
    });

    // Act
    const result = await gitlabSource.discover('https://git.example.org/team/tool');

    // Assert
    expect(result.success && result.data[0]?.icon).toBe('https://git.example.org/uploads/-/system/project/avatar/1/tool.png');
  });

  test('has no icon when neither the project nor the namespace has an avatar', async () => {
    // Arrange
    serve({
      'https://git.example.org/team/tool/-/releases.atom': ok(feedBody),
      'https://git.example.org/api/v4/projects/team%2Ftool': ok(JSON.stringify({ avatar_url: null, namespace: {} })),
    });

    // Act
    const result = await gitlabSource.discover('https://git.example.org/team/tool');

    // Assert
    expect(result.success && result.data[0]?.icon).toBeUndefined();
  });
});

describe('isGitlabLink', () => {
  test('detects gitlab.com URLs only', () => {
    // Act / Assert
    expect(isGitlabLink('https://gitlab.com/gitlab-org/gitlab')).toBe(true);
    expect(isGitlabLink('https://github.com/gitlab-org/gitlab')).toBe(false);
  });
});
