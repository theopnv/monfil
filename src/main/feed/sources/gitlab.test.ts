// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { gitlabCandidates, isGitlabLink } from './gitlab';

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
});

describe('isGitlabLink', () => {
  test('detects gitlab.com URLs only', () => {
    // Act / Assert
    expect(isGitlabLink('https://gitlab.com/gitlab-org/gitlab')).toBe(true);
    expect(isGitlabLink('https://github.com/gitlab-org/gitlab')).toBe(false);
  });
});
