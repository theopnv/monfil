// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ErrorParams } from '../../shared/errors';
import { fail, type Failure, type Result } from '../../shared/result';
import { dbReady } from './database';

type DbFailure = Failure<{ name: 'DB_ERROR'; message: string; params?: ErrorParams }>;

interface DbTryOptions<K> {
  /** Turns an error that the caller expects, such as a constraint violation, into its own failure. */
  mapKnown: (error: unknown) => K | undefined;
  /** The message for a thrown value that is not an `Error`. */
  fallback?: string;
}

/** Whether a database error carries this SQLite result code, such as `SQLITE_CONSTRAINT_UNIQUE`. */
export function hasSqliteCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

type ResultOfAnything = Result<unknown, { name: string; message: string }>;
type KnownFailure = Failure<{ name: string; message: string; params?: ErrorParams }>;

/**
 * Waits for the database, runs `run`, and turns anything it throws into a `DB_ERROR` failure.
 * A wait that fails is not caught: the caller sees the startup failure itself.
 */
export function dbTry<R extends ResultOfAnything>(run: () => Promise<R>, options?: { fallback?: string }): Promise<R | DbFailure>;
export function dbTry<R extends ResultOfAnything, K extends KnownFailure>(run: () => Promise<R>, options: DbTryOptions<K>): Promise<R | K | DbFailure>;
export async function dbTry(run: () => Promise<ResultOfAnything>, { mapKnown, fallback = 'An unknown error occurred' }: Partial<DbTryOptions<KnownFailure>> & { fallback?: string } = {}): Promise<ResultOfAnything | KnownFailure | DbFailure> {
  await dbReady;
  try {
    return await run();
  } catch (error) {
    return mapKnown?.(error) ?? fail('DB_ERROR', error instanceof Error ? error.message : fallback);
  }
}
