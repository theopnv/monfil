// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { sentryBuild } from './vite-plugin.mts';

vi.mock(import('@sentry/vite-plugin'), () => ({ sentryVitePlugin: vi.fn(() => ({ name: 'sentry-vite-plugin' })) }) as never);

const complete = { SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'monfil', SENTRY_PROJECT: 'desktop' };

describe('sentryBuild', () => {
  test.each([
    ['without a token', { ...complete, SENTRY_AUTH_TOKEN: undefined }],
    ['with an empty token', { ...complete, SENTRY_AUTH_TOKEN: '' }],
    ['without an organization', { ...complete, SENTRY_ORG: undefined }],
    ['without a project', { ...complete, SENTRY_PROJECT: '' }],
  ])('leaves the build unchanged %s', (_label, env) => {
    // Act
    const build = sentryBuild('1.2.3', env);

    // Assert
    expect(build).toEqual({ sourcemap: false, plugins: [] });
    expect(sentryVitePlugin).not.toHaveBeenCalled();
  });

  test('writes hidden source maps and uploads them as the release of this version to the EU region', () => {
    // Act
    const build = sentryBuild('1.2.3', complete);

    // Assert
    expect(build.sourcemap).toBe('hidden');
    expect(build.plugins).toHaveLength(1);
    expect(sentryVitePlugin).toHaveBeenCalledWith(expect.objectContaining({
      authToken: 'token',
      org: 'monfil',
      project: 'desktop',
      url: 'https://de.sentry.io',
      telemetry: false,
      release: { name: 'monfil@1.2.3' },
      sourcemaps: { filesToDeleteAfterUpload: ['.vite/**/*.map'] },
    }));
  });

  test('uses the host that the environment names', () => {
    // Act
    sentryBuild('1.2.3', { ...complete, SENTRY_URL: 'https://sentry.example.com' });

    // Assert
    expect(sentryVitePlugin).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://sentry.example.com' }));
  });

  test('fails the build when the upload fails', () => {
    // Arrange
    sentryBuild('1.2.3', complete);
    const options = vi.mocked(sentryVitePlugin).mock.calls[0]?.[0];

    // Act, Assert
    expect(() => options?.errorHandler?.(new Error('upload failed'))).toThrow('upload failed');
  });
});
