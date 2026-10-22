// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cruise, type IConfiguration } from 'dependency-cruiser';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 15_000 });

const config = createRequire(import.meta.url)('./.dependency-cruiser.cjs') as IConfiguration;

type Edge = [from: string, to: string];

let baseDir: string;

beforeEach(async () => {
  // dependency-cruiser reports resolved paths, so a symlinked temp folder (macOS /tmp) would never match the rules.
  baseDir = await realpath(await mkdtemp(path.join(tmpdir(), 'monfil-depcruise-')));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

async function writeModule(file: string, imports: string[]): Promise<void> {
  const target = path.join(baseDir, file);
  await mkdir(path.dirname(target), { recursive: true });
  const lines = imports.map((imported, index) => {
    let specifier = path.posix.relative(path.posix.dirname(file), imported).replace(/\.tsx?$/, '');
    if (!specifier.startsWith('.')) {
      specifier = `./${specifier}`;
    }
    return `import { value as value${index} } from '${specifier}';`;
  });
  await writeFile(target, [...lines, 'export const value = 1;', ''].join('\n'));
}

async function violatedRules(edges: Edge[]): Promise<string[]> {
  const importsByFile = new Map<string, string[]>();
  for (const [from, to] of edges) {
    importsByFile.set(from, [...(importsByFile.get(from) ?? []), to]);
    importsByFile.set(to, importsByFile.get(to) ?? []);
  }
  for (const [file, imports] of importsByFile) {
    await writeModule(file, imports);
  }

  const result = await cruise(['src'], { baseDir, validate: true, tsPreCompilationDeps: config.options?.tsPreCompilationDeps, ruleSet: { forbidden: config.forbidden ?? [] } }, { extensions: ['.ts', '.tsx'] });
  if (typeof result.output === 'string') {
    throw new TypeError('Expected a structured cruise result');
  }
  return result.output.summary.violations.map((violation) => violation.rule.name);
}

describe('dependency rules', () => {
  test.each<[string, Edge[]]>([
    ['no-circular', [['src/main/feed/a.ts', 'src/main/feed/b.ts'], ['src/main/feed/b.ts', 'src/main/feed/a.ts']]],
    ['no-folder-cycles', [['src/main/feed/a.ts', 'src/main/opml/b.ts'], ['src/main/opml/c.ts', 'src/main/feed/d.ts']]],
    ['main-root-is-entry-only', [['src/main/feed/a.ts', 'src/main/constants.ts']]],
    ['main-ipc-is-entry-only', [['src/main/feed/a.ts', 'src/main/ipc/sendToRenderer.ts']]],
    ['main-lib-is-a-leaf', [['src/main/lib/a.ts', 'src/main/feed/b.ts']]],
    ['main-logging-is-a-leaf', [['src/main/logging/a.ts', 'src/main/lib/b.ts']]],
    ['main-db-has-no-features', [['src/main/db/a.ts', 'src/main/feed/b.ts']]],
    ['main-feed-sources-skip-feed', [['src/main/feed/sources/a.ts', 'src/main/feed/b.ts']]],
    ['renderer-lib-skips-river', [['src/renderer/lib/a.ts', 'src/renderer/lib/river/b.ts']]],
    ['renderer-lib-has-no-ui', [['src/renderer/lib/a.ts', 'src/renderer/providers/b.tsx']]],
    ['renderer-providers-have-no-components', [['src/renderer/providers/a.tsx', 'src/renderer/components/Home/B.tsx']]],
  ])('reports %s', async (rule, edges) => {
    // Act
    const rules = await violatedRules(edges);

    // Assert
    expect(rules).toContain(rule);
  });

  test.each<[string, Edge[]]>([
    ['the main entry importing ipc', [['src/main/main.ts', 'src/main/ipc/registerIpcHandlers.ts']]],
    ['main/lib importing logging', [['src/main/lib/a.ts', 'src/main/logging/b.ts']]],
    ['a feature importing db and lib', [['src/main/feed/a.ts', 'src/main/db/b.ts'], ['src/main/feed/a.ts', 'src/main/lib/c.ts']]],
    ['a source adapter importing a sibling', [['src/main/feed/sources/a.ts', 'src/main/feed/sources/b.ts']]],
    ['renderer/lib/river importing renderer/lib', [['src/renderer/lib/river/a.ts', 'src/renderer/lib/b.ts']]],
    ['renderer/lib importing the vendored UI kit', [['src/renderer/lib/a.ts', 'src/renderer/components/untitled-ui/b.ts']]],
    ['a component importing a provider and lib', [['src/renderer/components/Home/A.tsx', 'src/renderer/providers/b.tsx'], ['src/renderer/providers/b.tsx', 'src/renderer/lib/c.ts']]],
  ])('allows %s', async (_name, edges) => {
    // Act
    const rules = await violatedRules(edges);

    // Assert
    expect(rules).toEqual([]);
  });
});
