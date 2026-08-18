import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { setFeedsShowInHome } from './update';
import { addFeedToDatabase, type NewFeedInput } from './insert';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [],
  categoryName: 'tech',
  showInHome: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [],
  categoryName: 'tech',
  showInHome: true,
};

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('setFeedsShowInHome', () => {
  test('sets showInHome to 0 then back to 1', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) throw new Error('expected the feed to be created');

    // Act
    const hidden = await setFeedsShowInHome([inserted.data.id], false);
    const hiddenRow = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(hidden.success).toBe(true);
    expect(hiddenRow.showInHome).toBe(0);

    // Act
    const shown = await setFeedsShowInHome([inserted.data.id], true);
    const shownRow = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(shown.success).toBe(true);
    expect(shownRow.showInHome).toBe(1);
  });

  test('updates a batch of several ids in one call', async () => {
    // Arrange
    const insertedA = await addFeedToDatabase(feedA);
    const insertedB = await addFeedToDatabase(feedB);
    if (!insertedA.success || !insertedB.success) throw new Error('expected both feeds to be created');

    // Act
    const result = await setFeedsShowInHome([insertedA.data.id, insertedB.data.id], false);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedMetadata').selectAll().where('id', 'in', [insertedA.data.id, insertedB.data.id]).execute();
    expect(rows.every((row) => row.showInHome === 0)).toBe(true);
  });

  test('an unknown id returns FEED_NOT_FOUND', async () => {
    // Act
    const result = await setFeedsShowInHome([999999], false);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await setFeedsShowInHome([], false);

    // Assert
    expect(result.success).toBe(true);
  });
});
