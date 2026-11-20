// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ErrorParams } from './errors';

export type Success<S> = { success: true; data: S };
export type Failure<E> = { success: false; error: E };

export type Result<S, E = Error> = Success<S> | Failure<E>;

export function ok(): Success<undefined>;
export function ok<S>(data: S): Success<S>;
export function ok(data?: unknown): Success<unknown> {
  return { success: true, data };
}

/** A failed `Result`. `params` fills the placeholders of the translated message, and is left out when absent. */
export function fail<N extends string>(name: N, message: string, params?: ErrorParams): Failure<{ name: N; message: string; params?: ErrorParams }> {
  return { success: false, error: { name, message, ...(params ? { params } : {}) } };
}

export interface UnexpectedError {
  name: 'UNEXPECTED_ERROR';
  message: string;
  incidentId: string;
}

export interface InvalidPayloadError {
  name: 'INVALID_PAYLOAD';
  message: string;
}

export type IpcBoundaryError = InvalidPayloadError | UnexpectedError;

export type IpcFailure = Failure<IpcBoundaryError>;

export function ipcFailure(name: 'INVALID_PAYLOAD'): IpcFailure;
export function ipcFailure(name: 'UNEXPECTED_ERROR', incidentId: string): IpcFailure;
export function ipcFailure(name: IpcBoundaryError['name'], incidentId?: string): IpcFailure {
  return name === 'INVALID_PAYLOAD'
    ? { success: false, error: { name, message: 'Invalid request payload.' } }
    : { success: false, error: { name, message: 'The operation could not be completed.', incidentId: incidentId ?? '' } };
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value !== '';
}

/** Whether a response is a failure that the IPC boundary made, as opposed to a `Result` that a handler returned. */
export function isIpcFailure(response: unknown): response is IpcFailure {
  if (field(response, 'success') !== false) {
    return false;
  }
  const error = field(response, 'error');
  const name = field(error, 'name');
  return isNonEmptyString(field(error, 'message'))
    && (name === 'INVALID_PAYLOAD' || (name === 'UNEXPECTED_ERROR' && isNonEmptyString(field(error, 'incidentId'))));
}
