// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { createCaps, type CapStore } from './caps';

function memoryStore(initial?: string): CapStore & { text: string | undefined } {
  const store = {
    text: initial,
    load: () => Promise.resolve(store.text),
    save: (text: string) => {
      store.text = text;
      return Promise.resolve();
    },
  };
  return store;
}

const limits = { perFingerprintPerSession: 1, perFingerprintPerDay: 2, totalPerDay: 3 };
const morning = () => new Date('2026-11-23T08:00:00Z');

describe('error report caps', () => {
  test('sends a fingerprint once per session', async () => {
    // Arrange
    const caps = createCaps(memoryStore(), limits, morning);

    // Act
    const first = await caps.accept('a');
    const second = await caps.accept('a');
    const other = await caps.accept('b');

    // Assert
    expect([first, second, other]).toEqual([true, false, true]);
  });

  test('keeps the daily count of a fingerprint across sessions', async () => {
    // Arrange
    const store = memoryStore();

    // Act
    const results = [];
    for (let session = 0; session < 3; session += 1) {
      results.push(await createCaps(store, limits, morning).accept('a'));
    }

    // Assert
    expect(results).toEqual([true, true, false]);
  });

  test('stops at the daily total of an install', async () => {
    // Arrange
    const store = memoryStore();
    const caps = createCaps(store, limits, morning);

    // Act
    const results = [await caps.accept('a'), await caps.accept('b'), await caps.accept('c'), await caps.accept('d')];

    // Assert
    expect(results).toEqual([true, true, true, false]);
  });

  test('starts again on the next day', async () => {
    // Arrange
    const store = memoryStore();
    for (const fingerprint of ['a', 'b', 'c']) {
      await createCaps(store, limits, morning).accept(fingerprint);
    }
    let clock = new Date('2026-11-24T00:00:01Z');

    // Act
    const next = await createCaps(store, limits, () => clock).accept('a');
    clock = new Date('2026-11-24T00:00:02Z');

    // Assert
    expect(next).toBe(true);
    expect(JSON.parse(store.text ?? '{}')).toMatchObject({ day: '2026-11-24', total: 1 });
  });

  test.each([['not json'], ['{"day":"2026-11-23","total":"many","fingerprints":{}}'], ['{"day":"2026-11-23","total":1,"fingerprints":null}'], ['null']])('treats the damaged text %s as an empty day', async (text) => {
    // Arrange
    const caps = createCaps(memoryStore(text), limits, morning);

    // Act, Assert
    await expect(caps.accept('a')).resolves.toBe(true);
  });

  test('counts parallel events in order', async () => {
    // Arrange
    const caps = createCaps(memoryStore(), { ...limits, perFingerprintPerSession: 5, totalPerDay: 2 }, morning);

    // Act
    const results = await Promise.all([caps.accept('a'), caps.accept('b'), caps.accept('c')]);

    // Assert
    expect(results).toEqual([true, true, false]);
  });

  test('still decides when the store cannot be read or written', async () => {
    // Arrange
    const caps = createCaps({ load: () => Promise.reject(new Error('db')), save: () => Promise.reject(new Error('db')) }, limits, morning);

    // Act, Assert
    await expect(caps.accept('a')).resolves.toBe(true);
    await expect(caps.accept('a')).resolves.toBe(false);
  });
});
