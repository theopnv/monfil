import { describe, expect, it } from 'vitest';
import { expectCount, expectObject, expectSha, expectString } from './expect.mts';

describe('expectObject', () => {
  it('returns a plain object', () => {
    // Arrange
    const value = { a: 1 };

    // Act
    const result = expectObject(value, 'diff');

    // Assert
    expect(result).toBe(value);
  });

  it.each([[null], [[]], ['text'], [3]])('refuses %j and names the field', (value) => {
    // Act
    const act = () => expectObject(value, 'diff.base');

    // Assert
    expect(act).toThrow('diff.base must be an object');
  });
});

describe('expectCount', () => {
  it.each([[0], [7], [Number.MAX_SAFE_INTEGER]])('accepts %d', (value) => {
    // Act
    const result = expectCount(value, 'n');

    // Assert
    expect(result).toBe(value);
  });

  it.each([[-1], [1.5], ['3'], [null], [Number.MAX_SAFE_INTEGER + 1], [Number.NaN]])('refuses %j', (value) => {
    // Act
    const act = () => expectCount(value, 'n');

    // Assert
    expect(act).toThrow('n must be a non-negative integer');
  });
});

describe('expectString', () => {
  it('accepts an empty string unless a non-empty one is required', () => {
    // Act
    const result = expectString('', 'date');

    // Assert
    expect(result).toBe('');
  });

  it('refuses a value that is not a string', () => {
    // Act
    const act = () => expectString(4, 'date');

    // Assert
    expect(act).toThrow('date must be a string');
  });

  it.each([[''], [4]])('refuses %j when a non-empty string is required', (value) => {
    // Act
    const act = () => expectString(value, 'date', { nonEmpty: true });

    // Assert
    expect(act).toThrow('date must be a non-empty string');
  });

  it('accepts a non-empty string when one is required', () => {
    // Act
    const result = expectString('x', 'date', { nonEmpty: true });

    // Assert
    expect(result).toBe('x');
  });
});

describe('expectSha', () => {
  it('accepts 40 lowercase hexadecimal characters', () => {
    // Arrange
    const sha = 'abcdef0123'.repeat(4);

    // Act
    const result = expectSha(sha, 'sha');

    // Assert
    expect(result).toBe(sha);
  });

  it.each([['a'.repeat(39)], ['A'.repeat(40)], ['g'.repeat(40)], [`${'a'.repeat(40)}\n`]])('refuses %j', (value) => {
    // Act
    const act = () => expectSha(value, 'sha');

    // Assert
    expect(act).toThrow('sha must be a commit sha');
  });

  it('refuses a value that is not a string', () => {
    // Act
    const act = () => expectSha(1, 'sha');

    // Assert
    expect(act).toThrow('sha must be a string');
  });
});
