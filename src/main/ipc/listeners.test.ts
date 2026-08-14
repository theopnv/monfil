import { describe, afterEach, test, expect, vi } from 'vitest';
import { listenToLinkOpen } from './listeners';
import { shell } from 'electron';

vi.mock(import('electron'), () => ({
  shell: {
    openExternal: vi.fn(),
  } as unknown as Electron.Shell,
}));

const mockedOpenExternal = vi.mocked(shell.openExternal);

describe('link:open IPC listener', () => {
  const mockEvent = {} as Electron.IpcMainEvent;

  afterEach(() => {
    mockedOpenExternal.mockReset();
  });

  test('should open external links for http and https protocols', () => {
    // Act
    listenToLinkOpen(mockEvent, 'https://example.com');

    // Assert
    expect(mockedOpenExternal).toHaveBeenCalledWith('https://example.com');
  });

  test('should not open external links for non-http/https protocols', () => {
    // Act
    listenToLinkOpen(mockEvent, 'ftp://example.com');

    // Assert
    expect(mockedOpenExternal).not.toHaveBeenCalled();
  });
});
