// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

const PROLOG_SNIFF_BYTES = 1024;

function bomEncoding(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return 'utf-16be';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le';
  }
  return undefined;
}

function headerCharset(contentType: string | undefined): string | undefined {
  return contentType?.match(/;\s*charset\s*=\s*"?([^";\s]+)"?/i)?.[1];
}

function prologEncoding(bytes: Uint8Array): string | undefined {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, PROLOG_SNIFF_BYTES));
  return head.match(/^\s*<\?xml\s[^>]*?\bencoding\s*=\s*["']([A-Za-z0-9._:-]+)["']/)?.[1];
}

function decoderFor(label: string | undefined): TextDecoder | undefined {
  if (label === undefined) {
    return undefined;
  }
  try {
    return new TextDecoder(label, { fatal: false });
  } catch {
    return undefined;
  }
}

/**
 * Decodes a fetched body with the charset it declares. A byte order mark wins, as the XML and
 * WHATWG specs require, then the `Content-Type` charset, then the XML prolog's `encoding`, then UTF-8.
 * Unknown labels are skipped and invalid bytes become U+FFFD.
 * @param bytes the raw response body
 * @param contentType the response's `Content-Type` header, if any
 * @returns the body as text, without a leading byte order mark
 */
export function decodeBody(bytes: Uint8Array, contentType: string | undefined): string {
  const decoder = decoderFor(bomEncoding(bytes))
    ?? decoderFor(headerCharset(contentType))
    ?? decoderFor(prologEncoding(bytes))
    ?? new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes);
}
