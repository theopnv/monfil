// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { hashUnit, type Unit } from './catalog.mts';
import { check, describe as describeProblems, updatedLock, type CheckInput } from './check.mts';
import { scanUsage } from './usage.mts';

const title: Unit = { id: 'common:title', forms: { '': 'Title' } };
const count: Unit = { id: 'river:count', forms: { one: '1 item', other: '{{count}} items' } };
const usage = scanUsage([{ name: 'a.ts', text: "t('title'); t('count');" }]);

function input(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    english: [title, count],
    languages: {
      fr: { units: [{ id: 'common:title', forms: { '': 'Titre' } }, { id: 'river:count', forms: { one: '1 élément', many: '{{count}} éléments', other: '{{count}} éléments' } }], missingFiles: [] },
    },
    lock: { fr: { 'common:title': hashUnit(title), 'river:count': hashUnit(count) } },
    usage,
    ...overrides,
  };
}

describe('check', () => {
  test('passes for a complete, locked translation', () => {
    // Act
    const report = check(input());

    // Assert
    expect(report.unusedEnglish).toEqual([]);
    expect(report.languages['fr']).toEqual({ missing: [], stale: [], unlocked: [], unused: [], placeholders: [], missingFiles: [] });
  });

  test('reports a unit with no translation and a file that is missing', () => {
    // Act
    const report = check(input({ languages: { fr: { units: [{ id: 'common:title', forms: { '': 'Titre' } }], missingFiles: ['river'] } } }));

    // Assert
    expect(report.languages['fr']?.missing).toEqual(['river:count']);
    expect(report.languages['fr']?.missingFiles).toEqual(['river']);
  });

  test('reports a plural that lacks a form its language needs', () => {
    // Act
    const report = check(input({ languages: { fr: { units: [{ id: 'common:title', forms: { '': 'Titre' } }, { id: 'river:count', forms: { one: '1', other: '{{count}}' } }], missingFiles: [] } } }));

    // Assert
    expect(report.languages['fr']?.missing).toEqual(['river:count']);
  });

  test('asks a language with one plural form for that form only', () => {
    // Act
    const report = check(input({
      languages: { ja: { units: [{ id: 'common:title', forms: { '': 'タイトル' } }, { id: 'river:count', forms: { other: '{{count}} 件' } }], missingFiles: [] } },
      lock: { ja: { 'common:title': hashUnit(title), 'river:count': hashUnit(count) } },
    }));

    // Assert
    expect(report.languages['ja']?.missing).toEqual([]);
  });

  test('reports a translation made from English text that changed', () => {
    // Act
    const report = check(input({ lock: { fr: { 'common:title': 'old-digest', 'river:count': hashUnit(count) } } }));

    // Assert
    expect(report.languages['fr']?.stale).toEqual(['common:title']);
  });

  test('reports a translation that no lock entry covers', () => {
    // Act
    const report = check(input({ lock: {} }));

    // Assert
    expect(report.languages['fr']?.unlocked).toEqual(['common:title', 'river:count']);
  });

  test('reports a translation of a key that English dropped', () => {
    // Act
    const report = check(input({ english: [title] }));

    // Assert
    expect(report.languages['fr']?.unused).toEqual(['river:count']);
  });

  test('reports a translation that adds or drops a placeholder', () => {
    // Arrange
    const welcome: Unit = { id: 'common:welcome', forms: { '': 'Hello <bold>{{name}}</bold>' } };

    // Act
    const report = check({
      english: [welcome],
      languages: { fr: { units: [{ id: 'common:welcome', forms: { '': 'Bonjour {{nom}}' } }], missingFiles: [] } },
      lock: { fr: { 'common:welcome': hashUnit(welcome) } },
      usage: scanUsage([{ name: 'a.ts', text: "t('welcome')" }]),
    });

    // Assert
    expect(report.languages['fr']?.placeholders).toEqual(['common:welcome adds {{nom}}', 'common:welcome drops <bold>', 'common:welcome drops {{name}}']);
  });

  test('reports an English unit that no source file names', () => {
    // Act
    const report = check(input({ usage: scanUsage([{ name: 'a.ts', text: "t('title')" }]) }));

    // Assert
    expect(report.unusedEnglish).toEqual(['river:count']);
  });
});

describe('describe', () => {
  test('gives one line per problem with what to do', () => {
    // Arrange
    const report = check(input({ lock: {}, english: [title], usage: scanUsage([]) }));

    // Act
    const lines = describeProblems(report, { requireAllLanguages: ['fr', 'de'] });

    // Assert
    expect(lines).toEqual([
      'unused English key: common:title. Delete it, or name it in the code that shows it.',
      'de: no translation files. Run npm run i18n:translate -- --lang de',
      'fr: unlocked common:title. Run npm run i18n:translate -- --sync-lock after you check the text.',
      'fr: unused river:count. Run npm run i18n:translate to remove it.',
    ]);
  });

  test('gives no line for a report without problems', () => {
    // Act / Assert
    expect(describeProblems(check(input()), { requireAllLanguages: [] })).toEqual([]);
  });
});

describe('updatedLock', () => {
  test('records the English text of now for a stale or unlocked translation', () => {
    // Arrange
    const stale = input({ lock: { fr: { 'common:title': 'old-digest' } } });

    // Act
    const lock = updatedLock(stale, check(stale));

    // Assert
    expect(lock['fr']).toEqual({ 'common:title': hashUnit(title), 'river:count': hashUnit(count) });
  });

  test('keeps the old entry of a key that has no translation or a broken placeholder, so it still fails', () => {
    // Arrange
    const welcome: Unit = { id: 'common:welcome', forms: { '': 'Hello {{name}}' } };
    const broken = input({
      english: [title, welcome, count],
      languages: { fr: { units: [{ id: 'common:title', forms: { '': 'Titre' } }, { id: 'common:welcome', forms: { '': 'Bonjour' } }], missingFiles: [] } },
      lock: { fr: { 'common:welcome': 'old-digest', 'river:count': 'old-count' } },
      usage: scanUsage([{ name: 'a.ts', text: "t('title'); t('welcome'); t('count');" }]),
    });

    // Act
    const lock = updatedLock(broken, check(broken));

    // Assert
    expect(lock['fr']).toEqual({ 'common:title': hashUnit(title), 'common:welcome': 'old-digest', 'river:count': 'old-count' });
  });

  test('drops the entry of a key that English no longer has and leaves other languages alone', () => {
    // Arrange
    const dropped = input({ lock: { fr: { 'common:gone': 'x' }, de: { 'common:title': 'de-digest' } } });

    // Act
    const lock = updatedLock(dropped, check(dropped));

    // Assert
    expect(lock['fr']).not.toHaveProperty('common:gone');
    expect(lock['de']).toEqual({ 'common:title': 'de-digest' });
  });

  test('keeps the entry of a plural whose form has a broken placeholder', () => {
    // Arrange
    const bad = input({ languages: { fr: { units: [{ id: 'common:title', forms: { '': 'Titre' } }, { id: 'river:count', forms: { one: '1', many: '{{total}}', other: '{{count}}' } }], missingFiles: [] } }, lock: { fr: { 'river:count': 'old-count' } } });

    // Act
    const lock = updatedLock(bad, check(bad));

    // Assert
    expect(lock['fr']?.['river:count']).toBe('old-count');
  });
});
