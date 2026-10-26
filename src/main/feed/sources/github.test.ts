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

  test('another feed of a repository is kept as it is, with the owner avatar', () => {
    // Act
    const candidates = githubCandidates('https://github.com/microsoft/playwright/commits/main.atom', false);

    // Assert
    expect(candidates).toEqual([{ link: 'https://github.com/microsoft/playwright/commits/main.atom', icon: 'https://github.com/microsoft.png' }]);
  });

  test('the activity feed of a user is kept as it is', () => {
    // Act
    const candidates = githubCandidates('https://github.com/torvalds.atom', false);

    // Assert
    expect(candidates).toEqual([{ link: 'https://github.com/torvalds.atom', label: 'Public activity', icon: 'https://github.com/torvalds.png' }]);
  });

  test('a first segment that ends in .atom is a user feed only when it is the whole path', () => {
    // Act
    const candidates = githubCandidates('https://github.com/odd.atom/repo', false);

    // Assert
    expect(candidates?.[0]?.link).toBe('https://github.com/odd.atom/repo/releases.atom');
  });

  test('".git" is cut only from the end of a repository name', () => {
    // Act
    const candidates = githubCandidates('https://github.com/octocat/octocat.github.io', false);

    // Assert
    expect(candidates?.[0]?.link).toBe('https://github.com/octocat/octocat.github.io/releases.atom');
  });

  test('a bare owner/repo with spaces around it resolves when the GitHub chip is picked', () => {
    // Act
    const candidates = githubCandidates('  microsoft/playwright  ', true);

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
    expect(isGithubLink('microsoft/playwright')).toBe(false);
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
  test('leaves no markup of its own making from crafted comments or tags, and drops unsafe links', () => {
    // Arrange
    const crafted = '<div class="push js-feed-item-view"><div class="color-fg-muted"><!-<!---->- hidden --> <scr<script>ipt>alert(1)</script> <a href="javascript:alert(1)">bad</a> <a href="/ok">ok</a></div></div>';

    // Act
    const description = githubSource.parse(feed(entry('tag:github.com,2008:push/2', crafted)))?.items[0]?.description ?? '';

    // Assert
    expect(description).not.toMatch(/<!--|<script|<scr|javascript:/i);
    expect(description).toContain('<a href="https://github.com/ok">ok</a>');
  });

  const descriptionOf = (content: string) => githubSource.parse(feed(entry('tag:github.com,2008:push/9', `<div class="x js-feed-item-view">${content}</div>`)))?.items[0]?.description;

  test('keeps an entry without a details box whole', () => {
    // Act
    const description = descriptionOf('<a href="/swyxio">swyxio</a> started following <a href="/gaearon">gaearon</a>');

    // Assert
    expect(description).toBe('<p><a href="https://github.com/swyxio">swyxio</a> started following <a href="https://github.com/gaearon">gaearon</a></p>');
  });

  test('keeps an http link and replaces a tag it does not keep with a space', () => {
    // Act
    const description = descriptionOf('one<span>two</span>three <a href="http://example.com/a">x</a>');

    // Assert
    expect(description).toBe('<p>one two three <a href="http://example.com/a">x</a></p>');
  });

  test('keeps only a link href: other tags lose their attributes', () => {
    // Act
    const description = descriptionOf('<code href="/x" class="y">c</code>');

    // Assert
    expect(description).toBe('<p><code>c</code></p>');
  });

  test('drops links with no text, whatever their href or spacing, and the time of the event', () => {
    // Act
    const description = descriptionOf('x<a href="/a"></a>y<a href="javascript:z">  </a>w <a href="/b">b</a><relative-time datetime="2026-10-16T19:33:34Z">October 16</relative-time>');

    // Assert
    expect(description).toBe('<p>xyw <a href="https://github.com/b">b</a></p>');
  });

  test('removes the private-use characters that stand in for tag brackets in the input', () => {
    // Arrange
    const open = String.fromCharCode(0xE000);
    const close = String.fromCharCode(0xE001);

    // Act
    const description = descriptionOf(`x ${open}b${close} y`);

    // Assert
    expect(description).toBe('<p>x b y</p>');
  });

  test('puts each paragraph and list of the details box in its own block and wraps loose text', () => {
    // Arrange
    const star = '<a href="/swyxio">swyxio</a> starred <a href="/smol-ai/skit">smol-ai/skit</a>'
      + '<div class="Box">loose one<p>A better way.</p><p><span>TypeScript</span> <a href="https://github.com/smol-ai/skit/stargazers">15</a></p>loose two</div>';

    // Act
    const description = descriptionOf(star);

    // Assert
    expect(description).toBe(
      '<p><a href="https://github.com/swyxio">swyxio</a> starred <a href="https://github.com/smol-ai/skit">smol-ai/skit</a></p>'
      + '<p>loose one</p><p>A better way.</p><p>TypeScript <a href="https://github.com/smol-ai/skit/stargazers">15 stars</a></p><p>loose two</p>',
    );
  });

  test.each(['https://example.com/picture.png', 'picture.png'])('keeps the thumbnail %s, which is not an avatar', (thumbnail) => {
    // Arrange
    const withPicture = feed(entry('tag:github.com,2008:Repository/1/v2', '<p>notes</p>').replace('https://avatars.githubusercontent.com/u/6764957?s=30&amp;v=4', thumbnail));

    // Act
    const parsed = githubSource.parse(withPicture);

    // Assert
    expect(parsed?.items[0]?.image).toBe(thumbnail);
  });
});
