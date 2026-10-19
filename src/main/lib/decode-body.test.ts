// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { decodeBody } from './decode-body';

const FRENCH_TITLE = 'Élections régionales : où en est-on ?';

function iso88591Feed(prolog: string): Uint8Array {
  return Buffer.from(`${prolog}<rss><channel><title>${FRENCH_TITLE}</title></channel></rss>`, 'latin1');
}

function utf16Feed(endianness: 'le' | 'be'): Uint8Array {
  const text = `<?xml version="1.0" encoding="UTF-16"?><rss><channel><title>${FRENCH_TITLE}</title></channel></rss>`;
  const le = Buffer.from(text, 'utf16le');
  if (endianness === 'le') {
    return Buffer.concat([Buffer.from([0xff, 0xfe]), le]);
  }
  return Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(le).swap16()]);
}

describe('decodeBody', () => {
  test('decodes UTF-8 when nothing declares a charset', () => {
    // Arrange
    const bytes = new TextEncoder().encode(`<rss><title>${FRENCH_TITLE}</title></rss>`);

    // Act
    const text = decodeBody(bytes, undefined);

    // Assert
    expect(text).toBe(`<rss><title>${FRENCH_TITLE}</title></rss>`);
  });

  test('uses the charset from the Content-Type header', () => {
    // Arrange
    const bytes = iso88591Feed('');

    // Act
    const text = decodeBody(bytes, 'application/rss+xml; charset=ISO-8859-1');

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('accepts a quoted charset parameter', () => {
    // Arrange
    const bytes = iso88591Feed('');

    // Act
    const text = decodeBody(bytes, 'text/xml; charset="windows-1252"');

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('falls back to the encoding in the XML prolog when the header has no charset', () => {
    // Arrange
    const bytes = iso88591Feed('<?xml version="1.0" encoding="ISO-8859-1"?>\n');

    // Act
    const text = decodeBody(bytes, 'application/xml');

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('reads a single-quoted prolog encoding after leading whitespace', () => {
    // Arrange
    const bytes = iso88591Feed("  \n<?xml version='1.0' encoding='iso-8859-1' standalone='yes'?>");

    // Act
    const text = decodeBody(bytes, undefined);

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('prefers the Content-Type charset over the XML prolog', () => {
    // Arrange
    const bytes = new TextEncoder().encode(`<?xml version="1.0" encoding="ISO-8859-1"?><title>${FRENCH_TITLE}</title>`);

    // Act
    const text = decodeBody(bytes, 'application/xml; charset=utf-8');

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test.each(['le', 'be'] as const)('decodes a BOM-prefixed UTF-16%s feed and strips the BOM', (endianness) => {
    // Arrange
    const bytes = utf16Feed(endianness);

    // Act
    const text = decodeBody(bytes, 'application/xml; charset=ISO-8859-1');

    // Assert
    expect(text.startsWith('<?xml')).toBe(true);
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('strips a UTF-8 BOM', () => {
    // Arrange
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<rss/>')]);

    // Act
    const text = decodeBody(bytes, undefined);

    // Assert
    expect(text).toBe('<rss/>');
  });

  test('ignores an unknown charset label and falls back to the next source', () => {
    // Arrange
    const bytes = iso88591Feed('<?xml version="1.0" encoding="ISO-8859-1"?>');

    // Act
    const text = decodeBody(bytes, 'application/xml; charset=x-not-a-charset');

    // Assert
    expect(text).toContain(`<title>${FRENCH_TITLE}</title>`);
  });

  test('replaces invalid bytes instead of throwing', () => {
    // Arrange
    const bytes = new Uint8Array([0x3c, 0x61, 0x3e, 0xff, 0x3c, 0x2f, 0x61, 0x3e]);

    // Act
    const text = decodeBody(bytes, 'text/xml; charset=utf-8');

    // Assert
    expect(text).toBe('<a>�</a>');
  });
});
