// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import enAddFeed from './locales/en/addFeed.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enMain from './locales/en/main.json';
import enReader from './locales/en/reader.json';
import enRiver from './locales/en/river.json';
import enSettings from './locales/en/settings.json';
import enWorkspace from './locales/en/workspace.json';

export const NAMESPACES = ['common', 'river', 'reader', 'settings', 'workspace', 'addFeed', 'errors', 'main'] as const;
export const DEFAULT_NAMESPACE = 'common';

// Every language ships in the bundle: the app works offline and a language switch needs no loading step.
export const resources = {
  en: {
    common: enCommon,
    river: enRiver,
    reader: enReader,
    settings: enSettings,
    workspace: enWorkspace,
    addFeed: enAddFeed,
    errors: enErrors,
    main: enMain,
  },
};
