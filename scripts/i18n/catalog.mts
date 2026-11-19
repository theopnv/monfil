// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createHash } from 'node:crypto';

export type Json = string | { [key: string]: Json };

/** The CLDR plural categories, which i18next reads from a key suffix such as `_one`. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** One translatable thing: a string, or the plural forms of a string. `id` is `namespace:path`, without a plural suffix. */
export interface Unit {
  id: string;
  /** The text by plural category. A string with no plural forms has the single form `''`. */
  forms: Record<string, string>;
}

/** Turns a namespace file into `path -> text`, with dots between the nesting levels. */
export function flatten(tree: Json, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof tree === 'string') {
    result.set(prefix, tree);
    return result;
  }
  for (const [key, value] of Object.entries(tree)) {
    for (const [path, text] of flatten(value, prefix ? `${prefix}.${key}` : key)) {
      result.set(path, text);
    }
  }
  return result;
}

/** Splits `readTime_other` into its base and plural category. A key that does not end in a category has none. */
export function splitPlural(path: string): { base: string; category: string } {
  const index = path.lastIndexOf('_');
  const suffix = path.slice(index + 1);
  if (index > 0 && PLURAL_CATEGORIES.some((category) => category === suffix)) {
    return { base: path.slice(0, index), category: suffix };
  }
  return { base: path, category: '' };
}

/** Groups the flat entries of one namespace into units, keeping the order of first appearance. */
export function toUnits(namespace: string, entries: ReadonlyMap<string, string>): Unit[] {
  const units = new Map<string, Unit>();
  for (const [path, text] of entries) {
    const { base, category } = splitPlural(path);
    const id = `${namespace}:${base}`;
    const unit = units.get(id) ?? { id, forms: {} };
    unit.forms[category] = text;
    units.set(id, unit);
  }
  return [...units.values()];
}

/** The plural categories that a language needs, as i18next reads them. */
export function pluralCategoriesOf(language: string): string[] {
  const categories = new Intl.PluralRules(language === 'zh' ? 'zh-Hans' : language).resolvedOptions().pluralCategories;
  return PLURAL_CATEGORIES.filter((category) => categories.includes(category));
}

/** Whether an English unit has plural forms, which a translation must give in the plural categories of its language. */
export function isPlural(unit: Unit): boolean {
  return Object.keys(unit.forms).some((category) => category !== '');
}

/** A short digest of what the English text says. It changes when any form changes. */
export function hashUnit(unit: Unit): string {
  const forms = Object.entries(unit.forms).sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(forms)).digest('hex').slice(0, 16);
}

/** The `{{name}}` values and the `<tag>` names of a text. A translation must keep every one of them. */
export function placeholdersOf(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)) {
    found.add(`{{${match[1] ?? ''}}}`);
  }
  for (const match of text.matchAll(/<\/?(\w+)\s*\/?>/g)) {
    found.add(`<${match[1] ?? ''}>`);
  }
  return [...found].sort();
}

/** The placeholders that every form of an English unit uses together. A translated form may leave one out ("one item" needs no count) but may not add one. */
export function allowedPlaceholders(unit: Unit): Set<string> {
  return new Set(Object.values(unit.forms).flatMap((text) => placeholdersOf(text)));
}

/** Compares a translated form with its English unit. The text of a form that is not plural must keep all placeholders. */
export function placeholderProblems(unit: Unit, form: string, translated: string): string[] {
  const allowed = allowedPlaceholders(unit);
  const used = new Set(placeholdersOf(translated));
  const added = [...used].filter((placeholder) => !allowed.has(placeholder));
  const source = unit.forms[form] ?? unit.forms['other'] ?? Object.values(unit.forms)[0] ?? '';
  const lost = isPlural(unit) ? [] : placeholdersOf(source).filter((placeholder) => !used.has(placeholder));
  return [...added.map((placeholder) => `adds ${placeholder}`), ...lost.map((placeholder) => `drops ${placeholder}`)];
}

/** The keys that a translation of `unit` needs in `language`. */
export function targetForms(unit: Unit, language: string): string[] {
  return isPlural(unit) ? pluralCategoriesOf(language) : [''];
}
