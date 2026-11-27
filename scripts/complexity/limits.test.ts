import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LIMITS } from './limits.mts';

describe('complexity limits', () => {
  test('the ingest workflow keeps the same limits as the scripts', () => {
    // Arrange
    const workflow = readFileSync(new URL('../../.github/workflows/complexity-ingest.yml', import.meta.url), 'utf8');

    // Act
    const inputs = [`cognitive-limit: ${LIMITS.cognitive}`, `cyclomatic-limit: ${LIMITS.cyclomatic}`];

    // Assert
    expect(inputs.filter((input) => !workflow.includes(input))).toEqual([]);
  });
});
