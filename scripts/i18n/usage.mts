// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { splitPlural } from './catalog.mts';

export interface UsageIndex {
  /** Every string that appears in the source as a whole literal. */
  literals: ReadonlySet<string>;
  /** The fixed start of every template literal that continues with a value, such as `codes.` in `` `codes.${name}` ``. */
  prefixes: readonly string[];
}

/** Reads the string literals of source files. A key that the code builds from parts shows up as a prefix. */
export function scanUsage(sources: readonly { name: string; text: string }[]): UsageIndex {
  const literals = new Set<string>();
  const prefixes = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      literals.add(node.text);
    } else if (ts.isTemplateExpression(node) && /[._:]$/.test(node.head.text)) {
      prefixes.add(node.head.text);
    }
    ts.forEachChild(node, visit);
  };
  for (const source of sources) {
    const kind = source.name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    visit(ts.createSourceFile(source.name, source.text, ts.ScriptTarget.Latest, true, kind));
  }
  return { literals, prefixes: [...prefixes] };
}

/** The names that code could use for a key: with and without the namespace, and without trailing context suffixes. */
function candidates(id: string): string[] {
  const [namespace = '', key = ''] = id.split(':');
  const names: string[] = [];
  let current = splitPlural(key).base;
  for (;;) {
    names.push(current, `${namespace}:${current}`);
    const cut = current.lastIndexOf('_');
    if (cut <= 0) {
      return names;
    }
    current = current.slice(0, cut);
  }
}

/** Whether some source file names the unit, directly or through a template literal prefix. */
export function isUsed(id: string, usage: UsageIndex): boolean {
  return candidates(id).some((name) => usage.literals.has(name) || usage.prefixes.some((prefix) => name.startsWith(prefix)));
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'locales', '__screenshots__']);

/** The source files whose strings can name a translation key: everything under `src/` except tests and the locale files. */
export function listSourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(full);
        }
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        found.push(full);
      }
    }
  };
  walk(path.join(root, 'src'));
  return found;
}

export function readSources(files: readonly string[]): { name: string; text: string }[] {
  return files.map((name) => ({ name, text: readFileSync(name, 'utf8') }));
}
