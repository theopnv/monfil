import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { getRefreshInterval, getRefreshOnLaunch } from '../settings';
import { refreshAllFeeds } from './refresh';
import { rescheduleRefresh, startRefreshScheduler, stopRefreshScheduler } from './scheduler';
import type { Feed } from '../../preload/channels';

vi.mock(import('./refresh'), () => ({ refreshAllFeeds: vi.fn() }));
vi.mock(import('../settings'), () => ({ getRefreshInterval: vi.fn(), getRefreshOnLaunch: vi.fn() }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedRefreshAllFeeds = vi.mocked(refreshAllFeeds);
const mockedGetRefreshInterval = vi.mocked(getRefreshInterval);
const mockedGetRefreshOnLaunch = vi.mocked(getRefreshOnLaunch);
const mockedBroadcast = vi.mocked(broadcastToRenderers);

const MINUTE = 60 * 1000;

const feed: Feed = {
  id: 1,
  link: 'https://a.example/feed',
  title: 'Feed A',
  category_id: 1,
  showInHome: 1,
  category: { id: 1, name: 'tech' },
  items: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  mockedRefreshAllFeeds.mockResolvedValue([feed]);
  mockedGetRefreshInterval.mockResolvedValue(15);
  mockedGetRefreshOnLaunch.mockResolvedValue(true);
});

afterEach(() => {
  stopRefreshScheduler();
  vi.useRealTimers();
  mockedRefreshAllFeeds.mockReset();
  mockedGetRefreshInterval.mockReset();
  mockedGetRefreshOnLaunch.mockReset();
  mockedBroadcast.mockReset();
});

describe('startRefreshScheduler', () => {
  test('refreshes once at launch and then on every period', async () => {
    // Act
    await startRefreshScheduler();

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);

    // Act
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(2);
  });

  test('broadcasts the refreshed list after each cycle', async () => {
    // Act
    await startRefreshScheduler();

    // Assert
    expect(mockedBroadcast).toHaveBeenCalledWith('feeds:list', [feed]);
  });

  test("runs the launch refresh but arms no timer when the interval is 'manual'", async () => {
    // Arrange
    mockedGetRefreshInterval.mockResolvedValue('manual');

    // Act
    await startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);
  });

  test('skips the launch refresh but still arms the timer when refresh-on-launch is off', async () => {
    // Arrange
    mockedGetRefreshOnLaunch.mockResolvedValue(false);

    // Act
    await startRefreshScheduler();

    // Assert
    expect(mockedRefreshAllFeeds).not.toHaveBeenCalled();

    // Act
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);
  });

  test('skips a tick that arrives while a cycle is still running', async () => {
    // Arrange
    const inFlight: (() => void)[] = [];
    mockedRefreshAllFeeds.mockImplementation(() => new Promise((resolve) => {
      inFlight.push(() => resolve([feed]));
    }));

    // Act
    const started = startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(45 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);

    // Act
    inFlight.forEach((finish) => {
      finish(); 
    });
    await started;
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(2);

    // Leaving a cycle hanging would keep the module's in-flight flag set for the next test.
    inFlight.forEach((finish) => {
      finish(); 
    });
    await vi.advanceTimersByTimeAsync(0);
  });

  test('keeps the timer running after a cycle fails', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedRefreshAllFeeds.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([feed]);

    // Act
    await startRefreshScheduler();
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(2);
    expect(mockedBroadcast).toHaveBeenCalledTimes(1);
  });
});

describe('rescheduleRefresh', () => {
  test('replaces the period without refreshing right away', async () => {
    // Arrange
    await startRefreshScheduler();

    // Act
    rescheduleRefresh(60);
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);

    // Act
    await vi.advanceTimersByTimeAsync(45 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(2);
  });

  test("'manual' disarms the timer", async () => {
    // Arrange
    await startRefreshScheduler();

    // Act
    rescheduleRefresh('manual');
    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);
  });
});

describe('stopRefreshScheduler', () => {
  test('stops the repeating refresh', async () => {
    // Arrange
    await startRefreshScheduler();

    // Act
    stopRefreshScheduler();
    await vi.advanceTimersByTimeAsync(60 * MINUTE);

    // Assert
    expect(mockedRefreshAllFeeds).toHaveBeenCalledTimes(1);
  });

  test('is safe to call when no timer is armed', () => {
    // Act, Assert
    expect(() => {
      stopRefreshScheduler(); 
    }).not.toThrow();
  });
});
