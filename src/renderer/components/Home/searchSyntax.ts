// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export const SEARCH_SYNTAX: { example: string; meaning: string }[] = [
  { example: "rust async", meaning: "Every word must match" },
  { example: '"machine learning"', meaning: "An exact phrase. Also matches inside longer words." },
  { example: "kubernetes OR k8s", meaning: "Either word (OR in capitals)" },
  { example: "-sponsored", meaning: "Leave out a word or a phrase" },
  { example: "title:release", meaning: "Match the title only" },
  { example: "ci", meaning: "A word of 3 letters or fewer matches whole words only" },
];
