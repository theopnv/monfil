import { describe, expect, it } from 'vitest';
import { splitTargets } from './targets.mts';

describe('splitTargets', () => {
  it('sends renderer files to the integration suite and the other process trees to the unit suite', () => {
    // Act
    const result = splitTargets(['src/main/feed/refresh.ts', 'src/shared/result.ts', 'src/preload/preload.ts', 'src/renderer/lib/hints.ts', 'src/renderer/routes/index.tsx']);

    // Assert
    expect(result).toEqual({
      unit: ['src/main/feed/refresh.ts', 'src/shared/result.ts', 'src/preload/preload.ts'],
      integration: ['src/renderer/lib/hints.ts', 'src/renderer/routes/index.tsx'],
    });
  });

  it.each([
    ['a test file', 'src/main/feed/refresh.test.ts'],
    ['a renderer test file', 'src/renderer/lib/hints.test.tsx'],
    ['a declaration file', 'src/renderer/vite-env.d.ts'],
    ['a vendored component', 'src/renderer/components/untitled-ui/base/button.tsx'],
    ['the generated route tree', 'src/renderer/routeTree.gen.ts'],
    ['a script', 'scripts/mutation/run.mts'],
    ['a doc', 'doc/src/content/docs/index.mdx'],
    ['a fixture', 'src/main/opml/__fixtures__/feedly-export.opml'],
  ])('skips %s', (_label, file) => {
    // Act
    const result = splitTargets([file]);

    // Assert
    expect(result).toEqual({ unit: [], integration: [] });
  });

  it('accepts Windows separators and lists a file once', () => {
    // Act
    const result = splitTargets(['src\\main\\a.ts', 'src/main/a.ts']);

    // Assert
    expect(result.unit).toEqual(['src/main/a.ts']);
  });
});
