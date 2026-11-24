// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Exception } from '@sentry/electron/main';

/** A failed worker pool chains one error per worker, and a refresh of a large library chains hundreds of the same one. */
const MAX_CHAINED_EXCEPTIONS = 10;

const DESTROYED_DATABASE_FINGERPRINT = ['database', 'driver-destroyed'];

function signature(exception: Exception): string {
  const frames = exception.stacktrace?.frames?.map(({ filename, function: name, lineno }) => `${filename ?? ''}:${name ?? ''}:${lineno ?? ''}`);
  return JSON.stringify([exception.type, exception.value, frames]);
}

/** Drops repeats of an error in the chain, then keeps the newest ones. Sentry lists the error that was thrown last, so the tail stays. */
export function collapseExceptions(exceptions: readonly Exception[]): Exception[] {
  const lastIndex = new Map(exceptions.map((exception, index) => [signature(exception), index]));
  const distinct = exceptions.filter((exception, index) => lastIndex.get(signature(exception)) === index);
  return distinct.slice(-MAX_CHAINED_EXCEPTIONS);
}

/** Gives every report of a closed database one group, whichever query hit it. Without it, each calling function opens its own issue. */
export function fingerprintOf(exceptions: readonly Exception[]): string[] | undefined {
  return exceptions.some((exception) => exception.value?.includes('driver has already been destroyed'))
    ? DESTROYED_DATABASE_FINGERPRINT
    : undefined;
}
