// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { hasHttpScheme, parseHttpUrl, withScheme } from './url';

describe('parseHttpUrl', () => {
  test.each(['http://example.com/a', 'https://example.com/a?x=1#y'])('parses %s', (value) => {
    // Act & Assert
    expect(parseHttpUrl(value)?.href).toBe(new URL(value).href);
  });

  test('resolves a relative link against the base', () => {
    // Act & Assert
    expect(parseHttpUrl('../feed.xml', 'https://example.com/blog/post')?.href).toBe('https://example.com/feed.xml');
  });

  test.each(['javascript:alert(1)', 'ftp://example.com/a', 'data:text/plain,hi', 'file:///etc/passwd', 'mailto:a@example.com', 'not a url', '', '/relative'])('rejects %j without a base', (value) => {
    // Act & Assert
    expect(parseHttpUrl(value)).toBeUndefined();
  });

  test('rejects a link whose scheme the base cannot change', () => {
    // Act & Assert
    expect(parseHttpUrl('javascript:alert(1)', 'https://example.com')).toBeUndefined();
  });
});

describe('hasHttpScheme', () => {
  test.each(['http://a.example', 'https://a.example', 'HTTPS://a.example'])('accepts %s', (value) => {
    // Act & Assert
    expect(hasHttpScheme(value)).toBe(true);
  });

  test.each(['a.example', 'ftp://a.example', 'xhttp://a.example', ' https://a.example', 'a.example/?next=https://b.example'])('rejects %j', (value) => {
    // Act & Assert
    expect(hasHttpScheme(value)).toBe(false);
  });
});

describe('withScheme', () => {
  test('keeps a link that starts with http or https, in any letter case', () => {
    // Act & Assert
    expect(withScheme('http://example.com/a')).toBe('http://example.com/a');
    expect(withScheme('HTTPS://example.com/a')).toBe('HTTPS://example.com/a');
  });

  test('adds https to a link with no scheme, even when a scheme appears later in it', () => {
    // Act & Assert
    expect(withScheme('example.com/a')).toBe('https://example.com/a');
    expect(withScheme('example.com/?next=https://other.example/')).toBe('https://example.com/?next=https://other.example/');
  });
});
