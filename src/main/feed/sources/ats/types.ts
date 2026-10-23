// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export type AtsProvider = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'recruitee' | 'teamtailor' | 'personio';

export type WorkMode = 'remote' | 'hybrid' | 'on-site';

/** A company's job board on one ATS: the identity the feed stores is `apiUrl`. */
export interface AtsBoard {
  provider: AtsProvider;
  slug: string;
  apiUrl: string;
  /** The board's own origin, for providers whose job links are built from it. */
  origin?: string;
}

/** One open position in a shape that does not depend on the ATS it came from. */
export interface AtsJob {
  id: string;
  title: string;
  url: string | undefined;
  html: string;
  /** ISO date of the first publication; empty when the ATS only gives dates that change on every edit. */
  publishedAt: string;
  location: string | undefined;
  workMode: WorkMode | undefined;
  salaryLabel: string | undefined;
  department: string | undefined;
  employmentType: string | undefined;
}

export interface AtsListing {
  company: string | undefined;
  jobs: AtsJob[];
}

export interface AtsProviderAdapter {
  readonly provider: AtsProvider;
  /** The board a page or API URL belongs to, or null when the URL is not this ATS's. Must not touch the network. */
  toBoard(url: URL): AtsBoard | null;
  /** Reads the API response, or returns null when it is not this ATS's shape. */
  normalize(body: string, board?: AtsBoard): AtsListing | null;
}
