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
import frAddFeed from './locales/fr/addFeed.json';
import frCommon from './locales/fr/common.json';
import frErrors from './locales/fr/errors.json';
import frMain from './locales/fr/main.json';
import frReader from './locales/fr/reader.json';
import frRiver from './locales/fr/river.json';
import frSettings from './locales/fr/settings.json';
import frWorkspace from './locales/fr/workspace.json';
import deAddFeed from './locales/de/addFeed.json';
import deCommon from './locales/de/common.json';
import deErrors from './locales/de/errors.json';
import deMain from './locales/de/main.json';
import deReader from './locales/de/reader.json';
import deRiver from './locales/de/river.json';
import deSettings from './locales/de/settings.json';
import deWorkspace from './locales/de/workspace.json';
import esAddFeed from './locales/es/addFeed.json';
import esCommon from './locales/es/common.json';
import esErrors from './locales/es/errors.json';
import esMain from './locales/es/main.json';
import esReader from './locales/es/reader.json';
import esRiver from './locales/es/river.json';
import esSettings from './locales/es/settings.json';
import esWorkspace from './locales/es/workspace.json';
import itAddFeed from './locales/it/addFeed.json';
import itCommon from './locales/it/common.json';
import itErrors from './locales/it/errors.json';
import itMain from './locales/it/main.json';
import itReader from './locales/it/reader.json';
import itRiver from './locales/it/river.json';
import itSettings from './locales/it/settings.json';
import itWorkspace from './locales/it/workspace.json';
import ptAddFeed from './locales/pt/addFeed.json';
import ptCommon from './locales/pt/common.json';
import ptErrors from './locales/pt/errors.json';
import ptMain from './locales/pt/main.json';
import ptReader from './locales/pt/reader.json';
import ptRiver from './locales/pt/river.json';
import ptSettings from './locales/pt/settings.json';
import ptWorkspace from './locales/pt/workspace.json';
import zhAddFeed from './locales/zh/addFeed.json';
import zhCommon from './locales/zh/common.json';
import zhErrors from './locales/zh/errors.json';
import zhMain from './locales/zh/main.json';
import zhReader from './locales/zh/reader.json';
import zhRiver from './locales/zh/river.json';
import zhSettings from './locales/zh/settings.json';
import zhWorkspace from './locales/zh/workspace.json';
import jaAddFeed from './locales/ja/addFeed.json';
import jaCommon from './locales/ja/common.json';
import jaErrors from './locales/ja/errors.json';
import jaMain from './locales/ja/main.json';
import jaReader from './locales/ja/reader.json';
import jaRiver from './locales/ja/river.json';
import jaSettings from './locales/ja/settings.json';
import jaWorkspace from './locales/ja/workspace.json';
import arAddFeed from './locales/ar/addFeed.json';
import arCommon from './locales/ar/common.json';
import arErrors from './locales/ar/errors.json';
import arMain from './locales/ar/main.json';
import arReader from './locales/ar/reader.json';
import arRiver from './locales/ar/river.json';
import arSettings from './locales/ar/settings.json';
import arWorkspace from './locales/ar/workspace.json';

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
  fr: {
    common: frCommon,
    river: frRiver,
    reader: frReader,
    settings: frSettings,
    workspace: frWorkspace,
    addFeed: frAddFeed,
    errors: frErrors,
    main: frMain,
  },
  de: {
    common: deCommon,
    river: deRiver,
    reader: deReader,
    settings: deSettings,
    workspace: deWorkspace,
    addFeed: deAddFeed,
    errors: deErrors,
    main: deMain,
  },
  es: {
    common: esCommon,
    river: esRiver,
    reader: esReader,
    settings: esSettings,
    workspace: esWorkspace,
    addFeed: esAddFeed,
    errors: esErrors,
    main: esMain,
  },
  it: {
    common: itCommon,
    river: itRiver,
    reader: itReader,
    settings: itSettings,
    workspace: itWorkspace,
    addFeed: itAddFeed,
    errors: itErrors,
    main: itMain,
  },
  pt: {
    common: ptCommon,
    river: ptRiver,
    reader: ptReader,
    settings: ptSettings,
    workspace: ptWorkspace,
    addFeed: ptAddFeed,
    errors: ptErrors,
    main: ptMain,
  },
  zh: {
    common: zhCommon,
    river: zhRiver,
    reader: zhReader,
    settings: zhSettings,
    workspace: zhWorkspace,
    addFeed: zhAddFeed,
    errors: zhErrors,
    main: zhMain,
  },
  ja: {
    common: jaCommon,
    river: jaRiver,
    reader: jaReader,
    settings: jaSettings,
    workspace: jaWorkspace,
    addFeed: jaAddFeed,
    errors: jaErrors,
    main: jaMain,
  },
  ar: {
    common: arCommon,
    river: arRiver,
    reader: arReader,
    settings: arSettings,
    workspace: arWorkspace,
    addFeed: arAddFeed,
    errors: arErrors,
    main: arMain,
  },
};
