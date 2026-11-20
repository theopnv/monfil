import { describe, expect, it } from 'vitest';
import { splitTargets } from './targets.mts';

describe('splitTargets', () => {
  it('keeps the main, preload and shared files, and leaves the renderer out', () => {
    // Act
    const result = splitTargets(['src/main/feed/refresh.ts', 'src/shared/result.ts', 'src/preload/preload.ts', 'src/renderer/lib/hints.ts', 'src/renderer/routes/index.tsx']);

    // Assert
    expect(result).toEqual({ unit: ['src/main/feed/refresh.ts', 'src/shared/result.ts', 'src/preload/preload.ts'] });
  });

  it.each([
    ['a test file', 'src/main/feed/refresh.test.ts'],
    ['a main-process test helper', 'src/main/test/db.ts'],
    ['a declaration file', 'src/shared/vite-env.d.ts'],
    ['a renderer file', 'src/renderer/lib/hints.ts'],
    ['a renderer component', 'src/renderer/components/Home/River.tsx'],
    ['a script', 'scripts/mutation/run.mts'],
    ['a doc', 'doc/src/content/docs/index.mdx'],
    ['a fixture', 'src/main/opml/__fixtures__/feedly-export.opml'],
  ])('skips %s', (_label, file) => {
    // Act
    const result = splitTargets([file]);

    // Assert
    expect(result).toEqual({ unit: [] });
  });

  it('accepts Windows separators and lists a file once', () => {
    // Act
    const result = splitTargets(['src\\main\\a.ts', 'src/main/a.ts']);

    // Assert
    expect(result.unit).toEqual(['src/main/a.ts']);
  });
});
