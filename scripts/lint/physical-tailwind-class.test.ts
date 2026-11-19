import { describe, expect, it } from 'vitest';
import { physicalClassSuggestion } from './physical-tailwind-class.mts';

describe('physicalClassSuggestion', () => {
  it.each([
    ['ml-2', 'ms-2'],
    ['mr-auto', 'me-auto'],
    ['-ml-1.5', '-ms-1.5'],
    ['pl-3', 'ps-3'],
    ['pr-[7px]', 'pe-[7px]'],
    ['scroll-ml-4', 'scroll-ms-4'],
    ['left-0', 'start-0'],
    ['right-1.5', 'end-1.5'],
    ['-right-px', '-end-px'],
    ['left-1/2', 'start-1/2'],
    ['right-(--offset)', 'end-(--offset)'],
    ['text-left', 'text-start'],
    ['text-right', 'text-end'],
    ['float-left', 'float-start'],
    ['clear-right', 'clear-end'],
    ['border-l', 'border-s'],
    ['border-r-2', 'border-e-2'],
    ['rounded-l', 'rounded-s'],
    ['rounded-tl', 'rounded-ss'],
    ['rounded-tr-lg', 'rounded-se-lg'],
    ['rounded-br-md', 'rounded-ee-md'],
    ['rounded-bl-xl', 'rounded-es-xl'],
    ['slide-in-from-left-2', 'slide-in-from-start-2'],
  ])('suggests the logical class for %s', (token, expected) => {
    // Act
    const result = physicalClassSuggestion(token);

    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    ['hover:pl-3', 'hover:ps-3'],
    ['group-focus-within:pr-7', 'group-focus-within:pe-7'],
    ['[&_blockquote]:border-l-2', '[&_blockquote]:border-s-2'],
    ['data-[open=true]:!ml-2', 'data-[open=true]:!ms-2'],
  ])('keeps the variants of %s', (token, expected) => {
    // Act
    const result = physicalClassSuggestion(token);

    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    'ms-2', 'me-auto', 'ps-3', 'pe-7', 'start-0', 'end-2', 'text-start', 'text-end', 'border-s', 'border-e-2',
    'rounded-s', 'rounded-ss-lg', 'rounded-lg', 'rounded-full', 'border-lg', 'border-secondary', 'border-b', 'border-t-2',
    'mx-2', 'px-3', 'pl', 'left', 'right-click', 'left-handed', 'text-center', 'text-lg', 'float-none', 'plan', 'mr', 'flex-none',
    'hover:ps-3',
  ])('accepts %s', (token) => {
    // Act
    const result = physicalClassSuggestion(token);

    // Assert
    expect(result).toBeNull();
  });
});
