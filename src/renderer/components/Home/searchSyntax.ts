// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export const SEARCH_SYNTAX: { example: string; meaning: "all" | "phrase" | "either" | "exclude" | "title" | "short" }[] = [
  { example: "rust async", meaning: "all" },
  { example: '"machine learning"', meaning: "phrase" },
  { example: "kubernetes OR k8s", meaning: "either" },
  { example: "-sponsored", meaning: "exclude" },
  { example: "title:release", meaning: "title" },
  { example: "ci", meaning: "short" },
];
