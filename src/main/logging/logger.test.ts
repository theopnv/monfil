import { describe, expect, test } from 'vitest';
import { redact } from './logger';

describe('log redaction', () => {
  test('removes sensitive fields and keeps identifiers', () => {
    // Arrange
    const record = { feedId: 42, feedName: 'Private feed', url: 'https://user:secret@example.com/private', count: 3 };

    // Act
    const result = redact(record);

    // Assert
    expect(result).toEqual({ feedId: 42, feedName: '[redacted]', url: '[redacted]', count: 3 });
  });

  test('removes paths from error text', () => {
    // Arrange
    const sensitivePath = ['', 'Users', 'person', 'Library', 'Application Support', 'monfil', 'data.db'].join('/');
    const message = `Failed at ${sensitivePath}`;

    // Act
    const result = redact(message);

    // Assert
    expect(result).not.toContain(sensitivePath);
  });
});
