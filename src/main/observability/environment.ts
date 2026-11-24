// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** The build source an error report names: the Microsoft Store and the Mac App Store, or GitHub for every other installer. */
export function resolveEnvironment(runtime: { windowsStore?: boolean | undefined; mas?: boolean | undefined }): 'store' | 'github' {
  return runtime.windowsStore || runtime.mas ? 'store' : 'github';
}
