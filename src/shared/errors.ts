// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** Values an error carries so the renderer can fill a translated sentence. Stored as JSON, so keep them plain. */
export type ErrorParams = Record<string, string | number | string[]>;

/** A failure that main sends or stores: a stable `name`, params for the sentence, and the raw English `message` for logs and the Details line. */
export interface CodedError {
  name: string;
  message: string;
  params?: ErrorParams;
}

/** The `reason` of an UNSUPPORTED_FORMAT error. Each one has its own sentence in the `errors` namespace. */
export const UNSUPPORTED_REASONS = [
  'notSupportedFeed',
  'notModified',
  'notLink',
  'noFeedAtAddress',
  'youtubeNoChannel',
  'youtubeNoVideoChannel',
  'youtubeNoPlaylistChannel',
  'youtubeNotRecognized',
  'youtubeNotChannelFeed',
  'conferenceNotDataset',
  'conferenceNotLink',
  'conferenceEmptyQuery',
  'conferenceIgnoredFilters',
  'conferenceUnknownTopic',
  'conferenceUnknownTopicSuggest',
  'conferenceUnknownPlace',
  'conferenceUnknownPlaceSuggest',
  'atsNotFound',
  'atsNotBoard',
  'mismatchGithub',
  'mismatchGitlab',
  'mismatchBluesky',
  'mismatchMastodon',
  'mismatchArxiv',
  'mismatchHackernews',
] as const;

export type UnsupportedReason = typeof UNSUPPORTED_REASONS[number];
