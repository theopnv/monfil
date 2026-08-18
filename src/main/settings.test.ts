import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from './database';
import { DEFAULT_REFRESH_INTERVAL, DEFAULT_REFRESH_ON_LAUNCH, getRefreshInterval, getRefreshOnLaunch, setRefreshInterval, setRefreshOnLaunch } from './settings';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('setting').execute();
});

describe('getRefreshInterval', () => {
  test('falls back to the default when nothing is stored', async () => {
    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored value is not a supported one', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: 'every other tuesday' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored value is empty', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: '' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored number is not one of the choices', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: '7' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('ignores the other settings rows', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'somethingElse', value: '15' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });
});

describe('setRefreshInterval', () => {
  test('stores a number of minutes and reads it back', async () => {
    // Act
    await setRefreshInterval(360);

    // Assert
    expect(await getRefreshInterval()).toBe(360);
  });

  test("stores 'manual' and reads it back", async () => {
    // Act
    await setRefreshInterval('manual');

    // Assert
    expect(await getRefreshInterval()).toBe('manual');
  });

  test('overwrites the previous choice instead of adding a row', async () => {
    // Act
    await setRefreshInterval(15);
    await setRefreshInterval('manual');

    // Assert
    expect(await getRefreshInterval()).toBe('manual');
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toHaveLength(1);
  });
});

describe('getRefreshOnLaunch', () => {
  test('falls back to the default when nothing is stored', async () => {
    // Act
    const value = await getRefreshOnLaunch();

    // Assert
    expect(value).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });

  test('falls back to the default when the stored value is garbage', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshOnLaunch', value: 'not-a-boolean' }).execute();

    // Act
    const value = await getRefreshOnLaunch();

    // Assert
    expect(value).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });
});

describe('setRefreshOnLaunch', () => {
  test('stores false and reads it back', async () => {
    // Act
    await setRefreshOnLaunch(false);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(false);
  });

  test('stores true and reads it back', async () => {
    // Act
    await setRefreshOnLaunch(true);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(true);
  });

  test('overwrites the previous choice instead of adding a row', async () => {
    // Act
    await setRefreshOnLaunch(false);
    await setRefreshOnLaunch(true);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(true);
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toHaveLength(1);
  });
});
