// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { logger } from '../logging/logger';
import { deleteAll, deleteDays, incrementCounter, isCountingEnabled, listDays, readDay, setCountingEnabled, utcDay } from './counters';

vi.mock(import('../logging/logger'), () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } }));

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(() => {
  setCountingEnabled(true);
});

afterEach(async () => {
  await db.deleteFrom('usage_counter').execute();
});

const day = new Date('2026-10-22T10:00:00Z');

describe('incrementCounter', () => {
  test('adds one per call on the day of the action', async () => {
    // Act
    await incrementCounter('articles_opened', day);
    await incrementCounter('articles_opened', day);
    await incrementCounter('searches', day);

    // Assert
    await expect(readDay('2026-10-22')).resolves.toEqual({ articles_opened: 2, searches: 1 });
  });

  test('keeps days apart, using the UTC day', async () => {
    // Act
    await incrementCounter('searches', new Date('2026-10-22T23:59:59Z'));
    await incrementCounter('searches', new Date('2026-10-23T00:00:00Z'));

    // Assert
    await expect(listDays()).resolves.toEqual(['2026-10-22', '2026-10-23']);
  });

  test('counts nothing while consent is not granted', async () => {
    // Arrange
    setCountingEnabled(false);

    // Act
    await incrementCounter('articles_opened', day);

    // Assert
    expect(isCountingEnabled()).toBe(false);
    await expect(listDays()).resolves.toEqual([]);
  });

  test('does not reject when the write fails', async () => {
    // Arrange
    await db.schema.alterTable('usage_counter').renameTo('usage_counter_moved').execute();

    // Act
    const counting = incrementCounter('articles_opened', day);

    // Assert
    await expect(counting).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith('operation.failure', { operation: 'usage-counter' }, expect.any(Error));
    await db.schema.alterTable('usage_counter_moved').renameTo('usage_counter').execute();
  });
});

describe('reading and deleting', () => {
  test('ignores a stored name that is not a counter', async () => {
    // Arrange
    await db.insertInto('usage_counter').values({ day: '2026-10-22', name: 'unknown_thing', value: 9 }).execute();

    // Act, Assert
    await expect(readDay('2026-10-22')).resolves.toEqual({});
  });

  test('deletes only the listed days', async () => {
    // Arrange
    await incrementCounter('searches', new Date('2026-10-20T00:00:00Z'));
    await incrementCounter('searches', new Date('2026-10-21T00:00:00Z'));
    await incrementCounter('searches', new Date('2026-10-22T00:00:00Z'));

    // Act
    await deleteDays(['2026-10-20', '2026-10-21']);

    // Assert
    await expect(listDays()).resolves.toEqual(['2026-10-22']);
  });

  test('deleting no days changes nothing', async () => {
    // Arrange
    await incrementCounter('searches', day);

    // Act
    await deleteDays([]);

    // Assert
    await expect(listDays()).resolves.toEqual(['2026-10-22']);
  });

  test('deleteAll removes every tally', async () => {
    // Arrange
    await incrementCounter('searches', new Date('2026-10-20T00:00:00Z'));
    await incrementCounter('searches', day);

    // Act
    await deleteAll();

    // Assert
    await expect(listDays()).resolves.toEqual([]);
  });

  test('utcDay formats a date as YYYY-MM-DD', () => {
    // Act, Assert
    expect(utcDay(new Date('2026-01-02T23:59:59Z'))).toBe('2026-01-02');
  });
});
