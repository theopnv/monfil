import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { forgeViteConfigs, originalName, wrapperSource } from './overlay.mts';

describe('forgeViteConfigs', () => {
  it('lists the main and renderer configs and skips the preload config', () => {
    // Arrange
    const forge = `
      build: [
        { entry: 'src/main/main.ts', config: 'vite.main.config.mts', target: 'main' },
        { entry: 'src/main/feed/extractArticleProcess.ts', config: 'vite.main.config.mts', target: 'main' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.mts', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mts' }],
      publisher: { name: '@electron-forge/publisher-github', config: { repository: {} } },`;

    // Act
    const result = forgeViteConfigs(forge);

    // Assert
    expect(result).toEqual([
      { file: 'vite.main.config.mts', target: 'main' },
      { file: 'vite.renderer.config.mts', target: 'renderer' },
    ]);
  });

  it('finds configs in the source folders', () => {
    // Act
    const result = forgeViteConfigs("config: 'src/main/vite.config.mts', config: 'src/renderer/vite.config.mts'");

    // Assert
    expect(result.map((ref) => ref.target)).toEqual(['main', 'renderer']);
  });
});

describe('originalName', () => {
  it('puts .original before the extension', () => {
    // Act
    const result = originalName(path.join('src', 'main', 'vite.config.mts'));

    // Assert
    expect(result).toBe(path.join('src', 'main', 'vite.config.original.mts'));
  });
});

describe('wrapperSource', () => {
  it('imports the original config and the plugins by relative paths', () => {
    // Arrange
    const config = path.join('/work', 'src', 'main', 'vite.config.mts');

    // Act
    const result = wrapperSource(config, path.join('/work', 'scripts', 'coverage', 'vite-plugins.mts'), 'main');

    // Assert
    expect(result).toContain("import original from './vite.config.original.mts';");
    expect(result).toContain("from '../../scripts/coverage/vite-plugins.mts';");
    expect(result).toContain("coveragePlugins('main')");
  });
});
