import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LIMITS } from './limits.mts';

describe('complexity limits', () => {
  test('the Worker keeps the same limits as the scripts', () => {
    // Arrange
    const workerSource = readFileSync(new URL('../../infra/devanalytics-worker/src/complexity/snapshot.ts', import.meta.url), 'utf8');

    // Act
    const declaration = `export const LIMITS = { cognitive: ${LIMITS.cognitive}, cyclomatic: ${LIMITS.cyclomatic} } as const;`;

    // Assert
    expect(workerSource).toContain(declaration);
  });
});
