// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Two modules import each other, directly or through others. Move the shared code into a module that both can import.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-folder-cycles',
      severity: 'error',
      comment: 'Two folders depend on each other. Move the shared code down into a folder that both can import, so the folder graph stays a tree of layers.',
      scope: 'folder',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'main-root-is-entry-only',
      severity: 'error',
      comment: 'Files in the root of src/main/ wire the app together. Code in a subfolder must not import them. Put the shared code in a subfolder such as src/main/app/ or src/main/lib/.',
      from: { path: '^src/main/.+/' },
      to: { path: '^src/main/[^/]+$' },
    },
    {
      name: 'main-ipc-is-entry-only',
      severity: 'error',
      comment: 'src/main/ipc/ registers the IPC handlers and depends on every feature. Only the src/main/ root may import it. To push events to the renderer, use src/main/lib/sendToRenderer.ts.',
      from: { pathNot: '^src/main/(ipc/|[^/]+$)' },
      to: { path: '^src/main/ipc/' },
    },
    {
      name: 'main-lib-is-a-leaf',
      severity: 'error',
      comment: 'src/main/lib/ holds helpers that every feature uses. It may import only src/main/logging/.',
      from: { path: '^src/main/lib/' },
      to: { path: '^src/main/', pathNot: '^src/main/(lib|logging)/' },
    },
    {
      name: 'main-logging-is-a-leaf',
      severity: 'error',
      comment: 'Every main-process folder logs. src/main/logging/ must not import any of them.',
      from: { path: '^src/main/logging/' },
      to: { path: '^src/main/', pathNot: '^src/main/logging/' },
    },
    {
      name: 'main-db-has-no-features',
      severity: 'error',
      comment: 'src/main/db/ is the storage layer. It may import only src/main/lib/ and src/main/logging/. Feature code calls the database, not the other way around.',
      from: { path: '^src/main/db/' },
      to: { path: '^src/main/', pathNot: '^src/main/(db|lib|logging)/' },
    },
    {
      name: 'main-feed-sources-skip-feed',
      severity: 'error',
      comment: 'src/main/feed/ runs the refresh and imports the source adapters. An adapter in src/main/feed/sources/ must not import back into src/main/feed/. Move the shared helper into src/main/feed/sources/ or src/main/lib/.',
      from: { path: '^src/main/feed/sources/' },
      to: { path: '^src/main/feed/[^/]+$' },
    },
    {
      name: 'renderer-lib-skips-river',
      severity: 'error',
      comment: 'src/renderer/lib/river/ builds on the general helpers in src/renderer/lib/. A file in the src/renderer/lib/ root must not import from src/renderer/lib/river/.',
      from: { path: '^src/renderer/lib/[^/]+$' },
      to: { path: '^src/renderer/lib/river/' },
    },
    {
      name: 'renderer-lib-has-no-ui',
      severity: 'error',
      comment: 'src/renderer/lib/ holds helpers and hooks without React context. A hook that reads a provider goes in src/renderer/providers/.',
      from: { path: '^src/renderer/lib/' },
      to: { path: '^src/renderer/(providers|components|routes)/', pathNot: '^src/renderer/components/untitled-ui/' },
    },
    {
      name: 'renderer-providers-have-no-components',
      severity: 'error',
      comment: 'Components read providers. A provider must not import a component or a route.',
      from: { path: '^src/renderer/providers/' },
      to: { path: '^src/renderer/(components|routes)/', pathNot: '^src/renderer/components/untitled-ui/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '/__screenshots__/', '/__fixtures__/', '^src/main/graft/', '^src/renderer/lib/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.dependency-cruiser.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'require', 'node', 'default'],
    },
  },
};
