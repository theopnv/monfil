import { describe, expect, it } from 'vitest';
import { codeSpan } from './markdown.mts';

describe('codeSpan', () => {
  it('uses a fence longer than any backtick run in the text', () => {
    // Act
    const result = codeSpan('a``b');

    // Assert
    expect(result).toBe('``` a``b ```');
  });

  it('removes line breaks, bidirectional overrides and table pipes', () => {
    // Act
    const result = codeSpan('a\nb\u202ec|d');

    // Assert
    expect(result).toBe('` a b c∣d `');
  });

  it('shortens long text', () => {
    // Act
    const result = codeSpan('x'.repeat(500));

    // Assert
    expect(result.length).toBeLessThan(130);
    expect(result).toContain('…');
  });
});
