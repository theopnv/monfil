// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { escapeText } from '../../text';
import { salaryFromText } from '../salary';
import type { AtsBoard, AtsJob, AtsListing, AtsProviderAdapter } from '../types';
import { isoFromText, joinParts } from '../values';
import { detectWorkMode } from '../workMode';
import { blocks, plain, textOf } from '../xml';

const HOST = /^([a-z0-9-]+)\.jobs\.personio\.(com|de)$/;

function descriptionOf(position: string): string {
  return blocks(position, 'jobDescription').map((section) => {
    const name = textOf(section, 'name');
    const value = textOf(section, 'value') ?? '';
    return `${name ? `<h3>${escapeText(name)}</h3>` : ''}${value}`;
  }).join('');
}

function toJob(position: string, board: AtsBoard | undefined): AtsJob | null {
  const id = textOf(position, 'id');
  const title = textOf(position, 'name');
  if (!id || !title) {
    return null;
  }
  const location = joinParts([textOf(position, 'office'), ...blocks(position, 'additionalOffices').flatMap((offices) => blocks(offices, 'office').map(plain))]);
  const html = descriptionOf(position);
  return {
    id,
    title,
    url: board?.origin ? `${board.origin}/job/${encodeURIComponent(id)}` : undefined,
    html,
    publishedAt: isoFromText(textOf(position, 'createdAt')),
    location,
    workMode: detectWorkMode(undefined, location, title, html.slice(0, 400)),
    salaryLabel: salaryFromText(html),
    department: textOf(position, 'department') ?? textOf(position, 'recruitingCategory'),
    employmentType: joinParts([textOf(position, 'schedule'), textOf(position, 'employmentType')], ' · '),
  };
}

export const personio: AtsProviderAdapter = {
  provider: 'personio',
  toBoard(url) {
    const match = HOST.exec(url.hostname.toLowerCase());
    if (!match?.[1] || !match[2]) {
      return null;
    }
    const origin = `https://${match[1]}.jobs.personio.${match[2]}`;
    return { provider: 'personio', slug: match[1], apiUrl: `${origin}/xml`, origin };
  },
  normalize(body, board): AtsListing | null {
    if (!body.includes('<workzag-jobs')) {
      return null;
    }
    const positions = blocks(body, 'position');
    return { company: positions[0] ? textOf(positions[0], 'subcompany') : undefined, jobs: positions.flatMap((position) => toJob(position, board) ?? []) };
  },
};
