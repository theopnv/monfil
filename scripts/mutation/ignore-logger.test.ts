import { describe, expect, it } from 'vitest';
import { isLoggerCall } from './ignore-logger.mts';

const identifier = (name: string) => ({ type: 'Identifier', name });
const call = (object: string) => ({ type: 'CallExpression', callee: { type: 'MemberExpression', object: identifier(object) } });

describe('isLoggerCall', () => {
  it('matches a logger call statement', () => {
    // Act
    const result = isLoggerCall({ type: 'ExpressionStatement', expression: call('logger') });

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ['a call on another object', { type: 'ExpressionStatement', expression: call('console') }],
    ['a logger call whose result the code reads', call('logger')],
    ['a call of a plain function', { type: 'ExpressionStatement', expression: { type: 'CallExpression', callee: identifier('logger') } }],
  ])('does not match %s', (_label, node) => {
    // Act
    const result = isLoggerCall(node);

    // Assert
    expect(result).toBe(false);
  });
});
