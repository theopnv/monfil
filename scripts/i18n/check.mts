// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { hashUnit, placeholderProblems, targetForms, type Unit } from './catalog.mts';
import { isUsed, type UsageIndex } from './usage.mts';

/** The saved digest of the English text that each translation was made from, by language and unit id. */
export type Lock = Record<string, Record<string, string>>;

export interface LanguageData {
  units: readonly Unit[];
  missingFiles: readonly string[];
}

export interface CheckInput {
  english: readonly Unit[];
  languages: Readonly<Record<string, LanguageData>>;
  lock: Lock;
  usage: UsageIndex;
}

export interface LanguageReport {
  /** English units with no translation, or with plural forms that the language needs and lacks. */
  missing: string[];
  stale: string[];
  /** Translations that no lock entry covers, such as a hand-written one. */
  unlocked: string[];
  unused: string[];
  placeholders: string[];
  missingFiles: string[];
}

export interface CheckReport {
  unusedEnglish: string[];
  languages: Record<string, LanguageReport>;
}

function checkLanguage(english: readonly Unit[], data: LanguageData, locked: Record<string, string>): LanguageReport {
  const translated = new Map(data.units.map((unit) => [unit.id, unit]));
  return { ...compare(english, translated, locked), missingFiles: [...data.missingFiles] };
}

function compare(english: readonly Unit[], translated: ReadonlyMap<string, Unit>, locked: Record<string, string>): Omit<LanguageReport, 'missingFiles'> {
  const missing: string[] = [];
  const stale: string[] = [];
  const unlocked: string[] = [];
  const placeholders: string[] = [];
  for (const unit of english) {
    const target = translated.get(unit.id);
    if (!target) {
      missing.push(unit.id);
      continue;
    }
    const digest = locked[unit.id];
    if (digest === undefined) {
      unlocked.push(unit.id);
    } else if (digest !== hashUnit(unit)) {
      stale.push(unit.id);
    }
    for (const [form, text] of Object.entries(target.forms)) {
      for (const problem of placeholderProblems(unit, form, text)) {
        placeholders.push(`${unit.id}${form ? `_${form}` : ''} ${problem}`);
      }
    }
  }
  const known = new Set(english.map((unit) => unit.id));
  const unused = [...translated.keys()].filter((id) => !known.has(id));
  return { missing, stale, unlocked, unused, placeholders };
}

export function check(input: CheckInput): CheckReport {
  const languages: Record<string, LanguageReport> = {};
  for (const [language, data] of Object.entries(input.languages)) {
    const report = checkLanguage(input.english, data, input.lock[language] ?? {});
    report.missing.push(...checkPlurals(input.english, data, language, report.missing));
    languages[language] = report;
  }
  return { unusedEnglish: input.english.filter((unit) => !isUsed(unit.id, input.usage)).map((unit) => unit.id), languages };
}

function checkPlurals(english: readonly Unit[], data: LanguageData, language: string, alreadyMissing: readonly string[]): string[] {
  const translated = new Map(data.units.map((unit) => [unit.id, unit]));
  const incomplete: string[] = [];
  for (const unit of english) {
    const target = translated.get(unit.id);
    if (!target || alreadyMissing.includes(unit.id)) {
      continue;
    }
    const lacking = targetForms(unit, language).filter((form) => !(form in target.forms) && !(form !== '' && '' in target.forms));
    if (lacking.length > 0) {
      incomplete.push(unit.id);
    }
  }
  return incomplete;
}

/**
 * The lock after a person, or Claude, brought the translations up to date. Every translation that exists and keeps its placeholders
 * is recorded as made from the English text of now. A key with no translation, or with a broken one, keeps the entry it had, so it still fails the check.
 */
export function updatedLock(input: CheckInput, report: CheckReport): Lock {
  const lock: Lock = {};
  const known = new Set(input.english.map((unit) => unit.id));
  for (const [language, data] of Object.entries(input.languages)) {
    const entry = report.languages[language];
    const blocked = new Set([...(entry?.missing ?? []), ...(entry?.placeholders.map((line) => line.split(' ')[0]?.replace(/_(zero|one|two|few|many|other)$/, '') ?? '') ?? [])]);
    const translated = new Set(data.units.map((unit) => unit.id));
    const next = Object.fromEntries(Object.entries(input.lock[language] ?? {}).filter(([id]) => known.has(id)));
    for (const unit of input.english) {
      if (translated.has(unit.id) && !blocked.has(unit.id)) {
        next[unit.id] = hashUnit(unit);
      }
    }
    lock[language] = next;
  }
  return { ...input.lock, ...lock };
}

export function describe(report: CheckReport, options: { requireAllLanguages: readonly string[] }): string[] {
  const lines: string[] = [];
  for (const id of report.unusedEnglish) {
    lines.push(`unused English key: ${id}. Delete it, or name it in the code that shows it.`);
  }
  for (const language of options.requireAllLanguages) {
    if (!(language in report.languages)) {
      lines.push(`${language}: no translation files. Run npm run i18n:translate -- --lang ${language}`);
    }
  }
  for (const [language, entry] of Object.entries(report.languages)) {
    for (const file of entry.missingFiles) {
      lines.push(`${language}: missing file ${file}.json`);
    }
    const groups: [string, string[], string][] = [
      ['missing', entry.missing, 'Run npm run i18n:translate.'],
      ['stale', entry.stale, 'The English text changed. Run npm run i18n:translate.'],
      ['unlocked', entry.unlocked, 'Run npm run i18n:translate -- --sync-lock after you check the text.'],
      ['unused', entry.unused, 'Run npm run i18n:translate to remove it.'],
      ['placeholder problem in', entry.placeholders, 'Fix the text so it keeps the {{values}} and <tags> of the English one.'],
    ];
    for (const [label, ids, hint] of groups) {
      for (const id of ids) {
        lines.push(`${language}: ${label} ${id}. ${hint}`);
      }
    }
  }
  return lines;
}
