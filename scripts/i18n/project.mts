// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LANGUAGE_CODES } from '../../src/shared/i18n/languages.ts';
import { flatten, toUnits, type Json, type Unit } from './catalog.mts';
import type { Lock } from './check.mts';

export const SOURCE_LANGUAGE = 'en';

export const TARGET_LANGUAGES: readonly string[] = LANGUAGE_CODES.filter((code) => code !== SOURCE_LANGUAGE);

export interface Project {
  root: string;
  localesDir: string;
  lockFile: string;
  glossaryFile: string;
}

export function projectAt(root: string): Project {
  const localesDir = path.join(root, 'src/shared/i18n/locales');
  return { root, localesDir, lockFile: path.join(localesDir, 'translations.lock.json'), glossaryFile: path.join(root, 'src/shared/i18n/glossary.json') };
}

export function namespacesOf(project: Project): string[] {
  return readdirSync(path.join(project.localesDir, SOURCE_LANGUAGE))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

export function presentLanguages(project: Project): string[] {
  return TARGET_LANGUAGES.filter((language) => existsSync(path.join(project.localesDir, language)));
}

export function readLanguage(project: Project, language: string, namespaces: readonly string[]): { units: Unit[]; missingFiles: string[] } {
  const units: Unit[] = [];
  const missingFiles: string[] = [];
  for (const namespace of namespaces) {
    const file = path.join(project.localesDir, language, `${namespace}.json`);
    if (existsSync(file)) {
      units.push(...toUnits(namespace, flatten(JSON.parse(readFileSync(file, 'utf8')) as Json)));
    } else {
      missingFiles.push(namespace);
    }
  }
  return { units, missingFiles };
}

export function readLock(project: Project): Lock {
  return existsSync(project.lockFile) ? JSON.parse(readFileSync(project.lockFile, 'utf8')) as Lock : {};
}

/** Writes the lock with sorted keys, so two branches that translate different keys merge without a conflict on order. */
export function writeLock(project: Project, lock: Lock): void {
  const sorted = Object.fromEntries(Object.entries(lock)
    .filter(([, entries]) => Object.keys(entries).length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([language, entries]) => [language, Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))]));
  writeFileSync(project.lockFile, `${JSON.stringify(sorted, null, 2)}\n`);
}
