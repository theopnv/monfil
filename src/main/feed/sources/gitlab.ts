// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../../lib/fetch';
import { createFeedSource, toUrl } from './feedSource';
import type { FeedCandidate } from './types';

const HOSTS = new Set(['gitlab.com', 'www.gitlab.com']);
const SEGMENT_REGEX = /^[\w.-]+$/;
const RELEASES_SUFFIX = '/-/releases.atom';

/**
 * The GitLab releases feed a project link leads to.
 * @param lenient accept any host, for self-hosted instances when the GitLab chip is picked
 */
export function gitlabCandidates(raw: string, lenient: boolean): FeedCandidate[] | null {
  const url = toUrl(raw);
  if (!url || (!lenient && !HOSTS.has(url.hostname.toLowerCase()))) {
    return null;
  }
  if (url.pathname.endsWith(RELEASES_SUFFIX)) {
    return [{ link: `${url.origin}${url.pathname}` }];
  }
  const projectPath = url.pathname.split('/-/')[0] ?? '';
  const segments = projectPath.split('/').filter(Boolean);
  if (segments.length < 2 || !segments.every((segment) => SEGMENT_REGEX.test(segment))) {
    return null;
  }
  return [{ link: `${url.origin}/${segments.join('/').replace(/\.git$/, '')}${RELEASES_SUFFIX}`, label: 'Releases' }];
}

export function isGitlabLink(raw: string): boolean {
  return gitlabCandidates(raw, false) !== null;
}

async function projectAvatar(candidate: FeedCandidate): Promise<string | undefined> {
  const url = new URL(candidate.link);
  const projectPath = url.pathname.slice(1, -RELEASES_SUFFIX.length);
  const result = await fetchText(`${url.origin}/api/v4/projects/${encodeURIComponent(projectPath)}`);
  if (!result.success) {
    return undefined;
  }
  const project = JSON.parse(result.data.body) as { avatar_url?: string | null; namespace?: { avatar_url?: string | null } };
  const avatar = project.avatar_url ?? project.namespace?.avatar_url ?? undefined;
  // Self-hosted instances answer with a path relative to their own origin.
  return avatar ? new URL(avatar, url.origin).href : undefined;
}

export const gitlabSource = createFeedSource({
  type: 'gitlab',
  fetchesFullArticle: false,
  toCandidates: gitlabCandidates,
  mismatchMessage: 'This is not a GitLab project link.',
  resolveIcon: projectAvatar,
});
