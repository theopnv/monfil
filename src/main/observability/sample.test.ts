// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { sampleErrorEvent } from './sample';

const userData = path.join(os.homedir(), 'AppData', 'monfil');

vi.mock(import('electron'), () => ({ app: { getPath: () => userData, getVersion: () => '1.2.3' } }) as never);

describe('sampleErrorEvent', () => {
  test('shows an event with the release, the tags, and the scrubbed message', () => {
    // Act
    const sample = sampleErrorEvent();

    // Assert
    expect(sample).toMatchObject({ release: 'monfil@1.2.3', level: 'error', tags: { logEvent: 'ipc.failure', channel: 'feeds:list', incidentId: '0a1b2c3d' } });
    expect(JSON.stringify(sample)).toContain('<userData>');
  });

  test('is the scrubbed form of a made-up failure, field by field', () => {
    // Act
    const sample = sampleErrorEvent() as Record<string, unknown> & { exception: { values: { value: string; stacktrace: { frames: { filename: string }[] } }[] } };

    // Assert
    expect(sample).toMatchObject({
      level: 'error',
      platform: 'node',
      environment: 'github',
      message: 'ipc.failure',
      tags: { logEvent: 'ipc.failure', channel: 'feeds:list', incidentId: '0a1b2c3d' },
      breadcrumbs: [{ category: 'monfil.log', level: 'info', message: 'app.lifecycle', data: { action: 'window-created' } }],
    });
    expect(sample['event_id']).toBe('00000000000000000000000000000000');
    expect(sample.exception.values[0]).toMatchObject({ type: 'Error', mechanism: { type: 'monfil.log', handled: true } });
    expect(sample.exception.values[0]?.value).toBe('Could not open <userData>/monfil.db or [url] for [email]');
    expect(sample.exception.values[0]?.stacktrace.frames[0]).toEqual({ filename: 'app:///.vite/build/main.cjs', function: 'dispatch', lineno: 120, colno: 14, in_app: true });
    expect(sample).not.toHaveProperty('user');
    expect(sample).not.toHaveProperty('request');
    expect(sample).not.toHaveProperty('server_name');
  });

  test('holds no home folder, link, email address, address of a network, host name, or feed field', () => {
    // Act
    const text = JSON.stringify(sampleErrorEvent());

    // Assert
    for (const secret of [os.homedir(), os.hostname(), 'example.com', 'name@', '203.0.113.7', 'Not sent', 'feedId']) {
      expect(text).not.toContain(secret);
    }
  });
});
