import type { PluginOption } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export interface SentryBuildEnv {
  SENTRY_AUTH_TOKEN?: string | undefined;
  SENTRY_ORG?: string | undefined;
  SENTRY_PROJECT?: string | undefined;
  SENTRY_URL?: string | undefined;
}

export interface SentryBuild {
  /** `false` leaves the Vite default. A build with an upload token writes hidden source maps, so no file points at them. */
  sourcemap: false | 'hidden';
  plugins: PluginOption[];
}

const DEFAULT_SENTRY_URL = 'https://de.sentry.io';

/**
 * Uploads the source maps of a build to Sentry under `monfil@<version>`, and deletes them once they are uploaded, so the
 * installers carry none. Without an upload token (pull requests, forks, local builds) the build is unchanged.
 */
export function sentryBuild(version: string, env: SentryBuildEnv = process.env): SentryBuild {
  const { SENTRY_AUTH_TOKEN: authToken, SENTRY_ORG: org, SENTRY_PROJECT: project, SENTRY_URL: url } = env;
  if (!authToken || !org || !project) {
    return { sourcemap: false, plugins: [] };
  }
  return {
    sourcemap: 'hidden',
    plugins: [sentryVitePlugin({
      authToken,
      org,
      project,
      url: url || DEFAULT_SENTRY_URL,
      telemetry: false,
      release: { name: `monfil@${version}` },
      sourcemaps: { filesToDeleteAfterUpload: ['.vite/**/*.map'] },
      // A failed upload must fail the packaging job, or a release would ship without readable stack traces.
      errorHandler: (error) => {
        throw error;
      },
    })],
  };
}
