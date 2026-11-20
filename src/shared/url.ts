// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** `value` as a URL, resolved against `base`, when it parses and its scheme is http or https. */
export function parseHttpUrl(value: string, base?: string | URL): URL | undefined {
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `value` starts with an http or https scheme. */
export function hasHttpScheme(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** `link` as it is when it names an http or https scheme, or with `https://` in front of it. */
export function withScheme(link: string): string {
  return hasHttpScheme(link) ? link : `https://${link}`;
}
