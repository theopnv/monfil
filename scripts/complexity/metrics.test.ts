import { describe, expect, it } from 'vitest';
import { parseScore } from './metrics.mts';

describe('parseScore', () => {
  it('reads the cost from the JSON cyclomatic message', () => {
    // Arrange
    const message = JSON.stringify({ message: 'Function has a complexity of 18 which is greater than 0 authorized.', cost: 18, secondaryLocations: [] });

    // Act
    const result = parseScore('@sonarjs/cyclomatic-complexity', message);

    // Assert
    expect(result).toBe(18);
  });

  it('reads the score from the cognitive message text', () => {
    // Arrange
    const message = 'Refactor this function to reduce its Cognitive Complexity from 46 to the 0 allowed.';

    // Act
    const result = parseScore('@sonarjs/cognitive-complexity', message);

    // Assert
    expect(result).toBe(46);
  });

  it('returns null for a message it cannot read', () => {
    // Arrange
    const message = 'Function has a complexity of 3.';

    // Act
    const result = parseScore('@sonarjs/cyclomatic-complexity', message);

    // Assert
    expect(result).toBeNull();
  });
});
