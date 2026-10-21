import { parse } from '@typescript-eslint/typescript-estree';
import { describe, expect, it } from 'vitest';
import { findFunctionAt, nameFunctions } from './naming.mts';

function names(code: string, jsx = false): string[] {
  return nameFunctions(parse(code, { loc: true, range: true, jsx })).map((fn) => fn.qualifiedName);
}

describe('nameFunctions', () => {
  it('uses the name of a function declaration', () => {
    // Arrange
    const code = 'function load() {}';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['load']);
  });

  it('takes the variable name for an arrow function', () => {
    // Arrange
    const code = 'export const load = async (id: number) => id;';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['load']);
  });

  it('looks through type assertions to the variable name', () => {
    // Arrange
    const code = 'const handler = ((event: Event) => event) satisfies Handler;';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['handler']);
  });

  it('takes the callee name for a callback and nests it under its parent function', () => {
    // Arrange
    const code = 'function River() { useEffect(() => { items.map((item) => item); }); }';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['River', 'River > useEffect', 'River > useEffect > map']);
  });

  it('keeps the first sibling without a suffix and numbers the next ones from 2', () => {
    // Arrange
    const code = 'function River() { useEffect(() => {}); useEffect(() => {}); useEffect(() => {}); }';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['River', 'River > useEffect', 'River > useEffect#2', 'River > useEffect#3']);
  });

  it('numbers children separately under each parent', () => {
    // Arrange
    const code = 'function a() { run(() => {}); } function b() { run(() => {}); }';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['a', 'a > run', 'b', 'b > run']);
  });

  it('adds the variable name when a callback is the value of a call', () => {
    // Arrange
    const code = 'function River() { const visible = useMemo(() => items.filter((item) => item.read), [items]); }';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['River', 'River > visible > useMemo', 'River > visible > useMemo > filter']);
  });

  it('names class methods, accessors and fields under the class', () => {
    // Arrange
    const code = 'class Store { constructor() {} get size() { return 0; } #reset() {} onChange = () => {}; }';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['Store > constructor', 'Store > get size', 'Store > #reset', 'Store > onChange']);
  });

  it('names object methods and nested properties by their keys', () => {
    // Arrange
    const code = "const routes = { home: { load() {}, 'on-exit': () => {} } };";

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['routes > home > load', 'routes > home > on-exit']);
  });

  it('names JSX handlers by their attribute, also behind a fallback', () => {
    // Arrange
    const code = 'function View() { return <Button onPress={onRetry ?? (() => retry())} />; }';

    // Act
    const result = names(code, true);

    // Assert
    expect(result).toEqual(['View', 'View > onPress']);
  });

  it('names a returned function "return"', () => {
    // Arrange
    const code = 'function useTimer() { useEffect(() => { return () => clear(); }); } const optional = (x) => (v) => v;';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['useTimer', 'useTimer > useEffect', 'useTimer > useEffect > return', 'optional', 'optional > return']);
  });

  it('names a default export "default"', () => {
    // Arrange
    const code = 'export default () => {};';

    // Act
    const result = names(code);

    // Assert
    expect(result).toEqual(['default']);
  });

  it('does not change names when lines are added above', () => {
    // Arrange
    const code = 'function River() { useEffect(() => {}); useEffect(() => {}); }';

    // Act
    const before = names(code);
    const after = names(`\n\n// comment\n${code}`);

    // Assert
    expect(after).toEqual(before);
  });
});

describe('findFunctionAt', () => {
  it('returns the innermost function that contains the position', () => {
    // Arrange
    const functions = nameFunctions(parse('function outer() {\n  run(() => {\n    go();\n  });\n}', { loc: true, range: true }));

    // Act
    const inner = findFunctionAt(functions, { line: 3, column: 4 });
    const outer = findFunctionAt(functions, { line: 1, column: 0 });

    // Assert
    expect(inner?.qualifiedName).toBe('outer > run');
    expect(outer?.qualifiedName).toBe('outer');
  });

  it('counts the method key as part of the method', () => {
    // Arrange
    const functions = nameFunctions(parse('class Store {\n  save() {}\n}', { loc: true, range: true }));

    // Act
    const result = findFunctionAt(functions, { line: 2, column: 2 });

    // Assert
    expect(result?.qualifiedName).toBe('Store > save');
    expect(result?.start.line).toBe(2);
  });

  it('returns nothing outside every function', () => {
    // Arrange
    const functions = nameFunctions(parse('const a = 1;\nfunction b() {}', { loc: true, range: true }));

    // Act
    const result = findFunctionAt(functions, { line: 1, column: 0 });

    // Assert
    expect(result).toBeUndefined();
  });
});
