// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

type Success<S> = { success: true; data: S };
type Failure<E> = { success: false; error: E };

export type Result<S, E = Error> = Success<S> | Failure<E>;

export interface UnexpectedError {
  name: 'UNEXPECTED_ERROR';
  message: string;
  incidentId: string;
}

export type IpcResult<T, E = never> = Result<T, E | UnexpectedError>;
