// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { githubCandidates, githubSource, isGithubLink } from './github';

describe('githubCandidates', () => {
  test('a repository URL offers its releases feed with the owner avatar', () => {
    // Act
    const candidates = githubCandidates('https://github.com/microsoft/playwright', false);

    // Assert
    expect(candidates).toEqual([
      { link: 'https://github.com/microsoft/playwright/releases.atom', label: 'Releases', icon: 'https://github.com/microsoft.png' },
    ]);
  });

  test('a deep repository URL and a .git suffix still resolve to the repository', () => {
    // Act
    const fromIssue = githubCandidates('github.com/microsoft/playwright/issues/123', false);
    const fromClone = githubCandidates('https://github.com/microsoft/playwright.git', false);

    // Assert
    expect(fromIssue?.[0]?.link).toBe('https://github.com/microsoft/playwright/releases.atom');
    expect(fromClone?.[0]?.link).toBe('https://github.com/microsoft/playwright/releases.atom');
  });

  test('a user or org URL offers its public activity feed', () => {
    // Act
    const user = githubCandidates('https://github.com/torvalds', false);
    const org = githubCandidates('https://github.com/orgs/microsoft/repositories', false);

    // Assert
    expect(user).toEqual([{ link: 'https://github.com/torvalds.atom', label: 'Public activity', icon: 'https://github.com/torvalds.png' }]);
    expect(org?.[0]?.link).toBe('https://github.com/microsoft.atom');
  });

  test('a stored feed URL is kept as it is', () => {
    // Act
    const candidates = githubCandidates('https://github.com/microsoft/playwright/releases.atom', false);

    // Assert
    expect(candidates?.[0]?.link).toBe('https://github.com/microsoft/playwright/releases.atom');
  });

  test('a bare owner/repo resolves only when the GitHub chip is picked', () => {
    // Act
    const withChip = githubCandidates('microsoft/playwright', true);
    const withoutChip = githubCandidates('microsoft/playwright', false);

    // Assert
    expect(withChip?.[0]?.link).toBe('https://github.com/microsoft/playwright/releases.atom');
    expect(withoutChip).toBeNull();
  });

  test('site pages and other hosts are rejected', () => {
    // Act / Assert
    expect(githubCandidates('https://github.com/settings/profile', false)).toBeNull();
    expect(githubCandidates('https://github.com/', false)).toBeNull();
    expect(githubCandidates('https://gitlab.com/gitlab-org/gitlab', false)).toBeNull();
  });
});

describe('isGithubLink', () => {
  test('detects GitHub URLs only', () => {
    // Act / Assert
    expect(isGithubLink('https://github.com/microsoft/playwright')).toBe(true);
    expect(isGithubLink('https://example.com/microsoft/playwright')).toBe(false);
  });
});

describe('githubSource.parse', () => {
  const PUSH_CONTENT = `<div class="repo-push js-feed-item-view"><div class="body">
<!-- push -->
<div class="d-flex flex-items-baseline tmp-py-4">
  <div class="d-flex flex-column width-full">
    <div class="color-fg-muted">
      <span class="mr-2"><a class="d-inline-block" href="/swyxio" rel="noreferrer"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6764957?s=64&amp;v=4" width="32" height="32" alt="@swyxio"></a></span>
      <a class="Link--primary no-underline wb-break-all" href="/swyxio" rel="noreferrer">swyxio</a>

      pushed to
        <a class="branch-name" href="/swyxio/papra/tree/main" rel="noreferrer">main</a>
        in
      <a class="Link--primary no-underline wb-break-all" href="/swyxio/papra" rel="noreferrer">swyxio/papra</a>
      <span>
        · <relative-time tense="past" datetime="2026-10-16T19:33:34Z" data-view-component="true">October 16, 2026 19:33</relative-time>
      </span>

        <div class="Box tmp-p-3 mt-2 color-shadow-medium color-bg-overlay">
          <span>1 commit to</span>
          <a class="branch-name" href="/swyxio/papra/tree/main" rel="noreferrer">main</a>

          <div class="commits pusher-is-only-committer">
            <ul class="list-style-none">
                <li class="d-flex flex-items-baseline">
                  <span>
                    <a class="d-inline-block" href="/swyxio" rel="noreferrer"><img class="mr-1 avatar-user" src="https://avatars.githubusercontent.com/u/6764957?s=32&amp;v=4" width="16" height="16" alt="@swyxio"></a>
                  </span>
                  <code><a class="mr-1" href="/swyxio/papra/commit/ad1414082f23473c32ec99838b82997474582aca" rel="noreferrer">ad14140</a></code>
                  <div class="dashboard-break-word lh-condensed">
                    <blockquote>
                      fix: label metadata edits in file activity
                    </blockquote>
                  </div>
                </li>
            </ul>
          </div>
        </div>
    </div>
  </div>
</div>
</div></div>`;

  const escape = (html: string) => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const entry = (id: string, content: string) => `
  <entry>
    <id>${id}</id>
    <published>2026-10-16T19:33:34Z</published>
    <link type="text/html" rel="alternate" href="https://github.com/swyxio/papra/compare/4601dbd26b...ad1414082f"/>
    <title type="html">swyxio pushed papra</title>
    <media:thumbnail height="30" width="30" url="https://avatars.githubusercontent.com/u/6764957?s=30&amp;v=4"/>
    <content type="html">${escape(content)}</content>
  </entry>`;

  const feed = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>GitHub Public Timeline Feed</title>
  ${entries.join('')}
</feed>`;

  test('turns dashboard markup into a sentence and a commit list with absolute links', () => {
    // Act
    const parsed = githubSource.parse(feed(entry('tag:github.com,2008:push/1', PUSH_CONTENT)));

    // Assert
    expect(parsed?.items[0]?.description).toBe(
      '<p><a href="https://github.com/swyxio">swyxio</a> pushed to <a href="https://github.com/swyxio/papra/tree/main">main</a> in <a href="https://github.com/swyxio/papra">swyxio/papra</a></p>'
      + '<p>1 commit to <a href="https://github.com/swyxio/papra/tree/main">main</a></p>'
      + '<ul><li><code><a href="https://github.com/swyxio/papra/commit/ad1414082f23473c32ec99838b82997474582aca">ad14140</a></code> fix: label metadata edits in file activity</li></ul>',
    );
  });

  test('drops the avatar thumbnail so it is not stretched into a cover image', () => {
    // Act
    const parsed = githubSource.parse(feed(entry('tag:github.com,2008:push/1', PUSH_CONTENT)));

    // Assert
    expect(parsed?.items[0]?.image).toBeUndefined();
  });

  test('keeps release notes as they are apart from making relative links absolute', () => {
    // Act
    const parsed = githubSource.parse(feed(entry('tag:github.com,2008:Repository/1/v1.0.0', '<h3>Bug Fixes</h3><ul><li><a href="/microsoft/playwright/issues/1">#1</a> fixed</li></ul>')));

    // Assert
    expect(parsed?.items[0]?.description).toBe('<h3>Bug Fixes</h3><ul><li><a href="https://github.com/microsoft/playwright/issues/1">#1</a> fixed</li></ul>');
  });
  test('names the star count, whose icon is dropped', () => {
    // Arrange
    const star = '<div class="star js-feed-item-view"><div class="color-fg-muted"><a href="/swyxio">swyxio</a> starred <a href="/smol-ai/skit">smol-ai/skit</a></div>'
      + '<div class="Box"><p>A better way to manage your agent skills.</p><p><span>TypeScript</span> <a href="https://github.com/smol-ai/skit/stargazers"><svg class="octicon"><path d="M8"></path></svg>15</a></p></div></div>';

    // Act
    const parsed = githubSource.parse(feed(entry('tag:github.com,2008:star/1', star)));

    // Assert
    expect(parsed?.items[0]?.description).toContain('<a href="https://github.com/smol-ai/skit/stargazers">15 stars</a>');
  });
});
