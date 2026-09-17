import { afterEach, describe, expect, test, vi } from 'vitest';
import { shell, type Session, type WebContents } from 'electron';
import { denyWebPermissions, hardenWebContents, isSameDocument, openExternalLink } from './window-security';

vi.mock(import('electron'), () => ({
  shell: {
    openExternal: vi.fn(),
  } as unknown as Electron.Shell,
}));

const mockedOpenExternal = vi.mocked(shell.openExternal);

const APP_URL = 'file:///Applications/monfil.app/renderer/index.html#/workspace/1';

afterEach(() => {
  mockedOpenExternal.mockReset();
});

describe('openExternalLink', () => {
  test.each(['https://example.com/post', 'http://example.com/post'])('hands %s to the OS', (url) => {
    // Act
    openExternalLink(url);

    // Assert
    expect(mockedOpenExternal).toHaveBeenCalledWith(url);
  });

  test.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'mailto:someone@example.com',
    'ftp://example.com',
    'not a url',
    '',
  ])('drops %j', (url) => {
    // Act
    openExternalLink(url);

    // Assert
    expect(mockedOpenExternal).not.toHaveBeenCalled();
  });
});

describe('isSameDocument', () => {
  test('ignores the fragment', () => {
    expect(isSameDocument(APP_URL, 'file:///Applications/monfil.app/renderer/index.html#/settings')).toBe(true);
  });

  test('accepts the same URL without a fragment', () => {
    expect(isSameDocument(APP_URL, 'file:///Applications/monfil.app/renderer/index.html')).toBe(true);
  });

  test('rejects another file', () => {
    expect(isSameDocument(APP_URL, 'file:///Users/someone/notes.txt')).toBe(false);
  });

  test('rejects a remote origin', () => {
    expect(isSameDocument(APP_URL, 'https://example.com/')).toBe(false);
  });

  test('rejects another path on the dev server origin', () => {
    expect(isSameDocument('http://localhost:5173/#/workspace/1', 'http://localhost:5173/admin')).toBe(false);
  });

  test('rejects a query string change', () => {
    expect(isSameDocument(APP_URL, 'file:///Applications/monfil.app/renderer/index.html?x=1')).toBe(false);
  });

  test('rejects malformed input', () => {
    expect(isSameDocument(APP_URL, 'not a url')).toBe(false);
    expect(isSameDocument('not a url', APP_URL)).toBe(false);
  });
});

describe('hardenWebContents', () => {
  function fakeWebContents() {
    const listeners = new Map<string, (...args: never[]) => void>();
    const contents = {
      getURL: () => APP_URL,
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((event: string, listener: (...args: never[]) => void) => {
        listeners.set(event, listener);
        return contents;
      }),
    };
    hardenWebContents(contents as unknown as WebContents);
    const windowOpenHandler = contents.setWindowOpenHandler.mock.calls[0]?.[0] as ((details: Electron.HandlerDetails) => Electron.WindowOpenHandlerResponse) | undefined;
    const willNavigate = listeners.get('will-navigate') as ((details: { url: string; preventDefault: () => void }) => void) | undefined;
    if (!windowOpenHandler || !willNavigate) {
      throw new Error('expected both guards to be registered');
    }
    return { windowOpenHandler, willNavigate };
  }

  function windowOpen(url: string): Electron.HandlerDetails {
    return { url, frameName: '', features: '', disposition: 'background-tab', referrer: { url: '', policy: 'default' } };
  }

  test('denies a new window and opens an http link in the browser', () => {
    // Arrange
    const { windowOpenHandler } = fakeWebContents();

    // Act
    const response = windowOpenHandler(windowOpen('https://example.com/post'));

    // Assert
    expect(response).toEqual({ action: 'deny' });
    expect(mockedOpenExternal).toHaveBeenCalledWith('https://example.com/post');
  });

  test('denies a new window and drops a non-http link', () => {
    // Arrange
    const { windowOpenHandler } = fakeWebContents();

    // Act
    const response = windowOpenHandler(windowOpen('javascript:alert(1)'));

    // Assert
    expect(response).toEqual({ action: 'deny' });
    expect(mockedOpenExternal).not.toHaveBeenCalled();
  });

  test('blocks navigation away from the app document', () => {
    // Arrange
    const { willNavigate } = fakeWebContents();
    const preventDefault = vi.fn();

    // Act
    willNavigate({ url: 'https://example.com/', preventDefault });

    // Assert
    expect(preventDefault).toHaveBeenCalled();
    expect(mockedOpenExternal).not.toHaveBeenCalled();
  });

  test('lets the app document reload', () => {
    // Arrange
    const { willNavigate } = fakeWebContents();
    const preventDefault = vi.fn();

    // Act
    willNavigate({ url: 'file:///Applications/monfil.app/renderer/index.html#/workspace/2', preventDefault });

    // Assert
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('denyWebPermissions', () => {
  test('refuses every permission request and check', () => {
    // Arrange
    const session = {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    };
    const callback = vi.fn();

    // Act
    denyWebPermissions(session as unknown as Session);
    const requestHandler = session.setPermissionRequestHandler.mock.calls[0]?.[0] as ((contents: unknown, permission: string, callback: (granted: boolean) => void) => void) | undefined;
    const checkHandler = session.setPermissionCheckHandler.mock.calls[0]?.[0] as (() => boolean) | undefined;
    requestHandler?.({}, 'notifications', callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(false);
    expect(checkHandler?.()).toBe(false);
  });
});
