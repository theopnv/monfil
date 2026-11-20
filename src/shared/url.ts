// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export function parseHttpUrl(value: string, base?: string | URL): URL | undefined {
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

export function hasHttpScheme(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function withScheme(link: string): string {
  return hasHttpScheme(link) ? link : `https://${link}`;
}
