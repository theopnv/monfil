// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import path from 'node:path';
import { check, describe, updatedLock } from './check.mts';
import { namespacesOf, presentLanguages, projectAt, readLanguage, readLock, SOURCE_LANGUAGE, TARGET_LANGUAGES, writeLock } from './project.mts';
import { listSourceFiles, readSources, scanUsage } from './usage.mts';

const root = path.resolve(import.meta.dirname, '../..');
const project = projectAt(root);
const namespaces = namespacesOf(project);
const requireAll = process.argv.includes('--all');

const english = readLanguage(project, SOURCE_LANGUAGE, namespaces).units;
const languages = Object.fromEntries(presentLanguages(project).map((language) => [language, readLanguage(project, language, namespaces)]));
const input = { english, languages, lock: readLock(project), usage: scanUsage(readSources(listSourceFiles(root))) };
let report = check(input);

if (process.argv.includes('--update-lock')) {
  writeLock(project, updatedLock(input, report));
  report = check({ ...input, lock: readLock(project) });
  process.stdout.write('i18n: recorded the English text of today for every translation that keeps its placeholders.\n');
}

const problems = describe(report, { requireAllLanguages: requireAll ? TARGET_LANGUAGES : [] });

const checked = Object.keys(languages);
process.stdout.write(`i18n: ${english.length} English keys, ${checked.length === 0 ? 'no other language has translations yet' : `checked ${checked.join(', ')}`}.\n`);
if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n')}\n\n${problems.length} i18n problem${problems.length === 1 ? '' : 's'}.\n`);
  process.exit(1);
}
