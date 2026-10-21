import path from 'node:path';
import type { CoverageTarget } from './vite-plugins.mts';

export interface ViteConfigRef {
  file: string;
  target: CoverageTarget;
}

/** Lists the Vite configs that a Forge config names, so that tags with another layout work too. The preload config is left out: its code runs in an isolated world. */
export function forgeViteConfigs(forgeConfig: string): ViteConfigRef[] {
  const files = [...new Set([...forgeConfig.matchAll(/config:\s*'([^']*vite[^']*)'/g)].map((match) => match[1] ?? ''))];
  return files.filter((file) => !file.includes('preload')).map((file) => ({
    file,
    target: file.includes('renderer') ? 'renderer' : 'main',
  }));
}

/** Names the file that keeps the original config: `vite.main.config.mts` becomes `vite.main.config.original.mts`. */
export function originalName(file: string): string {
  return file.replace(/(\.[cm]?[jt]s)$/, '.original$1');
}

function importPath(from: string, to: string): string {
  const relative = path.relative(path.dirname(from), to).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/** Source of a config that adds the coverage plugins to the original one, whether that exports an object or a function. */
export function wrapperSource(configFile: string, pluginsFile: string, target: CoverageTarget): string {
  return [
    "import { mergeConfig } from 'vite';",
    `import original from '${importPath(configFile, originalName(configFile))}';`,
    `import { coveragePlugins } from '${importPath(configFile, pluginsFile)}';`,
    '',
    'export default async (env: unknown) =>',
    `  mergeConfig(typeof original === 'function' ? await original(env) : original, { plugins: coveragePlugins('${target}') });`,
    '',
  ].join('\n');
}
