import { fileURLToPath } from 'node:url';
import { createInstrumenter } from 'istanbul-lib-instrument';
import { createFilter, type Plugin, type Rollup } from 'vite';

export type CoverageTarget = 'main' | 'renderer';

const DUMP_MODULE = 'virtual:coverage-dump';
const DUMP_FILE = fileURLToPath(new URL('./dump.mts', import.meta.url));

export const INCLUDE = ['src/**/*.{ts,tsx}'];
export const EXCLUDE = [
  'src/**/*.{test,spec}.{ts,tsx}',
  'src/**/*.d.ts',
  'src/renderer/components/untitled-ui/**',
  'src/renderer/routeTree.gen.ts',
];

function dumpPlugin(): Plugin {
  return {
    name: 'monfil:coverage-dump',
    enforce: 'pre',
    resolveId(id) {
      return id === DUMP_MODULE ? DUMP_FILE : null;
    },
    // The main config builds the app and the article extraction utility process. Each one has an entry that gets the dump.
    transform(code, id) {
      if (!this.getModuleInfo(id)?.isEntry) {
        return null;
      }
      // Same line as the first one, so that no line number moves.
      return { code: `import '${DUMP_MODULE}'; ${code}`, map: null };
    },
  };
}

/**
 * Instruments after every other transform, and hands the combined source map to Istanbul, so that
 * the report points at the original files. The full id names the coverage entry. A module with a query,
 * such as the router plugin's `?tsr-split=component`, then keeps its own entry instead of replacing
 * the entry of the same file. The merge step maps all of them back to the file.
 */
function instrumentPlugin(): Plugin {
  const instrumenter = createInstrumenter({
    coverageGlobalScope: 'globalThis',
    // The renderer's content security policy refuses `new Function`.
    coverageGlobalScopeFunc: false,
    esModules: true,
    produceSourceMap: true,
    autoWrap: true,
    preserveComments: true,
    compact: false,
  });
  const shouldInstrument = createFilter(INCLUDE, EXCLUDE, { resolve: process.cwd() });
  return {
    name: 'monfil:coverage-instrument',
    enforce: 'post',
    transform(code, id) {
      const [file = id] = id.split('?');
      if (!shouldInstrument(file)) {
        return null;
      }
      // Without the sources, the map in each coverage entry stays small.
      const sourceMap = JSON.parse(JSON.stringify({ ...this.getCombinedSourcemap(), sourcesContent: undefined })) as Parameters<typeof instrumenter.instrumentSync>[2];
      const instrumented = instrumenter.instrumentSync(code, id, sourceMap);
      return { code: instrumented, map: instrumenter.lastSourceMap() as unknown as Rollup.SourceMapInput };
    },
  };
}

/** Plugins for an instrumented build. Without `COVERAGE=1` there are none, so a normal build does not change. */
export function coveragePlugins(target: CoverageTarget): Plugin[] {
  if (process.env['COVERAGE'] !== '1') {
    return [];
  }
  return target === 'main' ? [dumpPlugin(), instrumentPlugin()] : [instrumentPlugin()];
}
