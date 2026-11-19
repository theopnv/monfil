// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { allowedPlaceholders, flatten, hashUnit, isPlural, placeholderProblems, placeholdersOf, pluralCategoriesOf, splitPlural, targetForms, toUnits } from './catalog.mts';

describe('flatten', () => {
  test('turns a nested file into dotted paths in file order', () => {
    // Arrange
    const tree = { menu: { feed: { refresh: 'Refresh' }, quit: 'Quit' }, title: 'Monfil' };

    // Act
    const flat = flatten(tree);

    // Assert
    expect([...flat]).toEqual([['menu.feed.refresh', 'Refresh'], ['menu.quit', 'Quit'], ['title', 'Monfil']]);
  });
});

describe('splitPlural', () => {
  test.each([
    { path: 'readTime_other', base: 'readTime', category: 'other' },
    { path: 'a.b_one', base: 'a.b', category: 'one' },
    { path: 'card.label_read', base: 'card.label_read', category: '' },
    { path: 'plain', base: 'plain', category: '' },
    { path: '_one', base: '_one', category: '' },
  ])('reads /Users/theop/.opencode/bin /Users/theop/.nvm/versions/node/v24.21.0/bin /opt/homebrew/bin /Users/theop/.local/bin /usr/local/bin /System/Cryptexes/App/usr/bin /usr/bin /bin /usr/sbin /sbin /var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin /var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin /var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin /pkg/env/global/bin /Library/Apple/usr/bin /Applications/VMware Fusion.app/Contents/Public /opt/homebrew/bin /Applications/iTerm.app/Contents/Resources/utilities /Users/theop/.orbstack/bin', ({ path, base, category }) => {
    // Act / Assert
    expect(splitPlural(path)).toEqual({ base, category });
  });
});

describe('toUnits', () => {
  test('groups plural forms under one id and keeps context keys apart', () => {
    // Arrange
    const entries = new Map([['count_one', '1 item'], ['count_other', '{{count}} items'], ['label_read', 'read'], ['label_unread', 'unread'], ['title', 'T']]);

    // Act
    const units = toUnits('river', entries);

    // Assert
    expect(units).toEqual([
      { id: 'river:count', forms: { one: '1 item', other: '{{count}} items' } },
      { id: 'river:label_read', forms: { '': 'read' } },
      { id: 'river:label_unread', forms: { '': 'unread' } },
      { id: 'river:title', forms: { '': 'T' } },
    ]);
  });
});

describe('pluralCategoriesOf', () => {
  test.each([
    { language: 'en', expected: ['one', 'other'] },
    { language: 'ja', expected: ['other'] },
    { language: 'zh', expected: ['other'] },
    { language: 'ar', expected: ['zero', 'one', 'two', 'few', 'many', 'other'] },
  ])('lists the categories of ', ({ language, expected }) => {
    // Act / Assert
    expect(pluralCategoriesOf(language)).toEqual(expected);
  });
});

describe('targetForms', () => {
  test('ask a plural unit for the forms of the language and a plain unit for one', () => {
    // Act / Assert
    expect(targetForms({ id: 'a:b', forms: { one: 'x', other: 'y' } }, 'ar')).toHaveLength(6);
    expect(targetForms({ id: 'a:b', forms: { one: 'x', other: 'y' } }, 'ja')).toEqual(['other']);
    expect(targetForms({ id: 'a:b', forms: { '': 'x' } }, 'ar')).toEqual(['']);
    expect(isPlural({ id: 'a:b', forms: { '': 'x' } })).toBe(false);
  });
});

describe('hashUnit', () => {
  test('changes with any form and ignores the order of the forms', () => {
    // Arrange
    const unit = { id: 'a:b', forms: { one: '1 item', other: '{{count}} items' } };

    // Act / Assert
    expect(hashUnit(unit)).toMatch(/^[0-9a-f]{16}$/);
    expect(hashUnit({ id: 'a:b', forms: { other: '{{count}} items', one: '1 item' } })).toBe(hashUnit(unit));
    expect(hashUnit({ id: 'a:b', forms: { one: '1 item', other: '{{count}} things' } })).not.toBe(hashUnit(unit));
    expect(hashUnit({ id: 'a:c', forms: unit.forms })).toBe(hashUnit(unit));
  });
});

describe('placeholders', () => {
  test('read values with a format and tags', () => {
    // Act / Assert
    expect(placeholdersOf('{{count, number}} in <bold>{{ name }}</bold> <code/>')).toEqual(['<bold>', '<code>', '{{count}}', '{{name}}']);
    expect(placeholdersOf('plain text')).toEqual([]);
  });

  test('let a plural form leave a value out but never add one', () => {
    // Arrange
    const unit = { id: 'a:b', forms: { one: 'One item', other: '{{count}} items' } };

    // Act / Assert
    expect(placeholderProblems(unit, 'one', 'Un élément')).toEqual([]);
    expect(placeholderProblems(unit, 'other', '{{count}} éléments')).toEqual([]);
    expect(placeholderProblems(unit, 'other', '{{total}} éléments')).toEqual(['adds {{total}}']);
    expect(allowedPlaceholders(unit)).toEqual(new Set(['{{count}}']));
  });

  test('need every value and tag of a text that is not plural', () => {
    // Arrange
    const unit = { id: 'a:b', forms: { '': 'Delete <bold>{{name}}</bold>?' } };

    // Act / Assert
    expect(placeholderProblems(unit, '', 'Supprimer <bold>{{name}}</bold> ?')).toEqual([]);
    expect(placeholderProblems(unit, '', 'Supprimer {{name}} ?')).toEqual(['drops <bold>']);
    expect(placeholderProblems(unit, '', 'Supprimer ?')).toEqual(['drops <bold>', 'drops {{name}}']);
  });
});
