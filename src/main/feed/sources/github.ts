// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFeedSource, toUrl } from './feedSource';
import type { FeedCandidate, NewSourceItem, ParsedFeedContent } from './types';

const HOSTS = new Set(['github.com', 'www.github.com']);
const NAME_REGEX = /^[\w.-]+$/;
// Owners cannot contain dots, which keeps a bare `example.com/page` from reading as `owner/repo`.
const OWNER_REPO_REGEX = /^([\w-]+)\/([\w.-]+)$/;
// First path segments that are GitHub's own pages, not a user or an org.
const RESERVED = new Set([
  'about', 'apps', 'codespaces', 'collections', 'contact', 'customer-stories', 'enterprise', 'events', 'explore',
  'features', 'issues', 'login', 'marketplace', 'new', 'notifications', 'pricing', 'pulls', 'search', 'security',
  'settings', 'signup', 'sponsors', 'team', 'topics', 'trending',
]);

function repoCandidate(owner: string, repo: string): FeedCandidate {
  const name = repo.replace(/\.git$/, '');
  return { link: `https://github.com/${owner}/${name}/releases.atom`, label: 'Releases', icon: `https://github.com/${owner}.png` };
}

function userCandidate(user: string): FeedCandidate {
  return { link: `https://github.com/${user}.atom`, label: 'Public activity', icon: `https://github.com/${user}.png` };
}

/**
 * The GitHub feeds a link leads to: releases for a repository, public activity for a user or an org.
 * @param lenient accept a bare `owner/repo`, for when the GitHub chip is picked
 */
export function githubCandidates(raw: string, lenient: boolean): FeedCandidate[] | null {
  const trimmed = raw.trim();
  const bare = OWNER_REPO_REGEX.exec(trimmed);
  if (lenient && bare?.[1] && bare[2]) {
    return [repoCandidate(bare[1], bare[2])];
  }

  const url = toUrl(trimmed);
  if (!url || !HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const [first, second] = segments;
  if (!first) {
    return null;
  }
  if (first === 'orgs' && second && NAME_REGEX.test(second)) {
    return [userCandidate(second)];
  }
  if (segments.length === 1 && first.endsWith('.atom')) {
    return [{ ...userCandidate(first.slice(0, -'.atom'.length)), link: `https://github.com${url.pathname}` }];
  }
  if (RESERVED.has(first.toLowerCase()) || !NAME_REGEX.test(first)) {
    return null;
  }
  if (!second) {
    return [userCandidate(first)];
  }
  if (url.pathname.endsWith('.atom')) {
    return [{ link: `https://github.com${url.pathname}`, icon: `https://github.com/${first}.png` }];
  }
  return NAME_REGEX.test(second) ? [repoCandidate(first, second)] : null;
}

export function isGithubLink(raw: string): boolean {
  return githubCandidates(raw, false) !== null;
}

const ORIGIN = 'https://github.com';
const AVATAR_HOST = 'avatars.githubusercontent.com';
const ACTIVITY_MARKER = 'js-feed-item-view';
const TAG_REGEX = /<\/?([a-z][\w-]*)([^>]*)>/gi;
const HREF_REGEX = /\bhref\s*=\s*"([^"]*)"/i;

function absolute(href: string): string {
  try {
    return new URL(href, ORIGIN).href;
  } catch {
    return href;
  }
}

function absolutizeLinks(html: string): string {
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${ORIGIN}/`);
}

/** Keeps only `allowed` tags, without their attributes except an absolute `href` on links, and collapses whitespace. */
function keepTags(html: string, allowed: ReadonlySet<string>): string {
  return html
    .replace(TAG_REGEX, (tag: string, name: string, attributes: string) => {
      const tagName = name.toLowerCase();
      if (!allowed.has(tagName)) {
        return ' ';
      }
      if (tag.startsWith('</')) {
        return `</${tagName}>`;
      }
      const href = tagName === 'a' ? HREF_REGEX.exec(attributes)?.[1] : undefined;
      return href ? `<a href="${absolute(href)}">` : `<${tagName}>`;
    })
    .replace(/<a href="[^"]*">\s*<\/a>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(<\/?(?:p|ul|li)>)\s*/g, '$1')
    .trim();
}

const INLINE_TAGS = new Set(['a', 'code']);
const BODY_TAGS = new Set(['a', 'code', 'p', 'ul', 'li']);

/**
 * Turns an activity entry's dashboard markup, which only reads right with GitHub's own CSS, into a
 * sentence and the event's details, e.g. the pushed commits.
 */
function simplifyActivity(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/·?\s*<relative-time\b[\s\S]*?<\/relative-time>/gi, '');
  const boxStart = stripped.search(/<div class="Box\b/);
  const header = keepTags(boxStart === -1 ? stripped : stripped.slice(0, boxStart), INLINE_TAGS);
  const body = boxStart === -1 ? '' : keepTags(stripped.slice(boxStart), BODY_TAGS)
    .replace(/(<a href="[^"]*\/stargazers">)([^<]+)<\/a>/g, '$1$2 stars</a>');
  const blocks = body
    .split(/(<p>[\s\S]*?<\/p>|<ul>[\s\S]*?<\/ul>)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('<p>') || part.startsWith('<ul>') ? part : `<p>${part}</p>`));
  return [`<p>${header}</p>`, ...blocks].join('');
}

function isAvatar(image: string | undefined): boolean {
  try {
    return image !== undefined && new URL(image).hostname === AVATAR_HOST;
  } catch {
    return false;
  }
}

function cleanItem(item: NewSourceItem): NewSourceItem {
  return {
    ...item,
    description: item.description.includes(ACTIVITY_MARKER) ? simplifyActivity(item.description) : absolutizeLinks(item.description),
    // Every entry carries its author's 30px avatar, which the river would stretch into a blurry cover.
    image: isAvatar(item.image) ? undefined : item.image,
  };
}

function cleanEntries(content: ParsedFeedContent): ParsedFeedContent {
  return { ...content, items: content.items.map(cleanItem) };
}

export const githubSource = createFeedSource({
  type: 'github',
  fetchesFullArticle: false,
  toCandidates: githubCandidates,
  mismatchMessage: 'This is not a GitHub repository or user link.',
  transform: cleanEntries,
});
