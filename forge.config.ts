import fs from 'node:fs/promises';
import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'assets/icons/icon',
    extraResource: ['assets/icons/icon.png'],
    // The Vite plugin's own `ignore` keeps only `.vite/**`, dropping node_modules entirely.
    // vite.main.config.mts marks a few packages (better-sqlite3, jsdom) as Rollup `external`
    // since they can't be bundled, so their real files need to survive packaging. Keeping
    // node_modules here lets the default `prune` step (packagerConfig.prune, on unless set
    // false) trim it back down to production dependencies only.
    ignore: (file) => {
      if (!file) {
        return false;
      }
      return !(file.startsWith('/.vite') || file.startsWith('/node_modules'));
    },
    afterCopy: [
      // better-sqlite3 ships one prebuild per platform/arch; keep only the one this
      // package targets so foreign-arch binaries don't reach the rpm maker's strip step.
      async (buildPath, _electronVersion, platform, arch, callback) => {
        try {
          const prebuildsDir = path.join(buildPath, 'node_modules', 'better-sqlite3', 'prebuilds');
          const keep = `${platform}-${arch}.node`;
          const files = await fs.readdir(prebuildsDir);
          await Promise.all(
            files.filter((file) => file !== keep).map((file) => fs.rm(path.join(prebuildsDir, file))),
          );
          callback();
        } catch (err) {
          callback(err as Error);
        }
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ setupIcon: 'assets/icons/icon.ico' }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({ options: { icon: 'assets/icons/icon.png' } }),
    new MakerDeb({ options: { icon: 'assets/icons/icon.png' } }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // .node binaries can't be dlopen'd from inside an asar archive, so better-sqlite3's
    // prebuilds need to live unpacked alongside it.
    new AutoUnpackNativesPlugin({}),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'theopnv',
          name: 'monfil'
        },
        prerelease: false,
        draft: true
      }
    }
  ]
};

export default config;
