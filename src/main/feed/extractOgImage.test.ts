import { describe, expect, test } from 'vitest';
import { extractOgImageUrl } from './extractOgImage';

describe('extractOgImageUrl', () => {
  test('reads og:image when property comes before content', () => {
    const result = extractOgImageUrl('<meta property="og:image" content="https://example.com/a.jpg">');
    expect(result).toBe('https://example.com/a.jpg');
  });

  test('reads og:image when content comes before property', () => {
    const result = extractOgImageUrl('<meta content="https://example.com/b.jpg" property="og:image">');
    expect(result).toBe('https://example.com/b.jpg');
  });

  test('reads attributes wrapped in single quotes', () => {
    const result = extractOgImageUrl("<meta property='og:image' content='https://example.com/c.jpg'>");
    expect(result).toBe('https://example.com/c.jpg');
  });

  test('reads og:image with extra attributes in between', () => {
    const result = extractOgImageUrl('<meta content="https://example.com/d.jpg" property="og:image" data-rh="true">');
    expect(result).toBe('https://example.com/d.jpg');
  });

  test('falls back to twitter:image when og:image is absent', () => {
    const result = extractOgImageUrl('<meta name="twitter:image" content="https://example.com/e.jpg">');
    expect(result).toBe('https://example.com/e.jpg');
  });

  test('prefers og:image when both og:image and twitter:image are present', () => {
    const html = '<meta property="og:image" content="https://example.com/og.jpg">'
      + '<meta name="twitter:image" content="https://example.com/twitter.jpg">';
    const result = extractOgImageUrl(html);
    expect(result).toBe('https://example.com/og.jpg');
  });

  test('ignores an unrelated meta tag', () => {
    const result = extractOgImageUrl('<meta name="description" content="https://example.com/f.jpg">');
    expect(result).toBeUndefined();
  });

  test('returns undefined when no meta tag matches', () => {
    const result = extractOgImageUrl('<html><head><title>No og image</title></head></html>');
    expect(result).toBeUndefined();
  });

  test('returns undefined for an empty string', () => {
    const result = extractOgImageUrl('');
    expect(result).toBeUndefined();
  });
});
