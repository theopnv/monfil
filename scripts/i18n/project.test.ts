// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { rmTestDir } from '../../src/main/lib/rmTestDir.ts';
import { namespacesOf, presentLanguages, projectAt, readLanguage, readLock, writeLock } from './project.mts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'monfil-i18n-'));
  mkdirSync(path.join(root, 'src/shared/i18n/locales/en'), { recursive: true });
  writeFileSync(path.join(root, 'src/shared/i18n/locales/en/river.json'), JSON.stringify({ count_one: '1', count_other: '{{count}}', title: 'T' }));
  writeFileSync(path.join(root, 'src/shared/i18n/locales/en/common.json'), JSON.stringify({ ok: 'OK' }));
});

afterEach(async () => {
  await rmTestDir(root);
});

describe('project files', () => {
  test('lists the namespaces of the English folder and the languages that have a folder', () => {
    // Arrange
    const project = projectAt(root);
    mkdirSync(path.join(project.localesDir, 'fr'));

    // Act / Assert
    expect(namespacesOf(project)).toEqual(['common', 'river']);
    expect(presentLanguages(project)).toEqual(['fr']);
  });

  test('reads the units of a language and the namespaces it has no file for', () => {
    // Arrange
    const project = projectAt(root);

    // Act
    const english = readLanguage(project, 'en', ['common', 'river']);
    const french = readLanguage(project, 'fr', ['common']);

    // Assert
    expect(english.units.map((unit) => unit.id)).toEqual(['common:ok', 'river:count', 'river:title']);
    expect(english.missingFiles).toEqual([]);
    expect(french).toEqual({ units: [], missingFiles: ['common'] });
  });

  test('writes the lock with sorted keys and without a language that has no entry', () => {
    // Arrange
    const project = projectAt(root);

    // Act
    writeLock(project, { fr: { 'b:x': '2', 'a:y': '1' }, de: {}, ar: { 'a:z': '3' } });

    // Assert
    expect(readFileSync(project.lockFile, 'utf8')).toBe('{\n  "ar": {\n    "a:z": "3"\n  },\n  "fr": {\n    "a:y": "1",\n    "b:x": "2"\n  }\n}\n');
    expect(readLock(project)).toEqual({ ar: { 'a:z': '3' }, fr: { 'a:y': '1', 'b:x': '2' } });
  });

  test('reads an empty lock when the file does not exist', () => {
    // Act / Assert
    expect(readLock(projectAt(root))).toEqual({});
  });
});
