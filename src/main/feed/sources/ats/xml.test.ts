// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { blocks, plain, textOf } from './xml';

describe('blocks', () => {
  test('lists the raw inner text of each element, in order', () => {
    // Act / Assert
    expect(blocks('<r><i>a</i><i id="2">b\nc</i><o>x</o></r>', 'i')).toEqual(['a', 'b\nc']);
  });

  test('matches a tag name literally, so a pattern character does not act as a pattern', () => {
    // Act / Assert
    expect(blocks('<aXb>1</aXb><a.b>2</a.b>', 'a.b')).toEqual(['2']);
    expect(blocks('<a+b>1</a+b><aab>2</aab>', 'a+b')).toEqual(['1']);
    expect(blocks('<a$b>1</a$b>', 'a$b')).toEqual(['1']);
  });

  test('does not read a longer tag name that starts with the same letters', () => {
    // Act / Assert
    expect(blocks('<item2>x</item2><items>y</items>', 'item')).toEqual([]);
  });

  test('returns nothing without the tag', () => {
    // Act / Assert
    expect(blocks('<r></r>', 'i')).toEqual([]);
    expect(blocks('', 'i')).toEqual([]);
  });

  test('keeps an empty element as an empty string', () => {
    // Act / Assert
    expect(blocks('<i></i>', 'i')).toEqual(['']);
  });
});

describe('plain', () => {
  test.each([
    ['text', 'text'],
    ['  padded \n', 'padded'],
    ['a &amp; b &lt;c&gt; &quot;d&quot; &#169;', 'a & b <c> "d" ©'],
    ['<![CDATA[<p>Hi &amp; bye</p>]]>', '<p>Hi &amp; bye</p>'],
    ['  \n<![CDATA[ spaced ]]>\n  ', 'spaced'],
  ])('reads %j as %j', (raw, expected) => {
    // Act / Assert
    expect(plain(raw)).toBe(expected);
  });

  test.each(['see <![CDATA[x]]>', '<![CDATA[x]]> tail', 'x <![CDATA[y]]> z'])('does not unwrap %j, which is more than a CDATA section', (raw) => {
    // Act / Assert
    expect(plain(raw)).toBe(raw);
  });

  test.each(['', '   ', '\n\t', '<![CDATA[]]>', '<![CDATA[   ]]>', ' <![CDATA[]]> '])('reads %j as undefined', (raw) => {
    // Act / Assert
    expect(plain(raw)).toBeUndefined();
  });
});

describe('textOf', () => {
  test('reads the text of the first matching element', () => {
    // Act / Assert
    expect(textOf('<r><t>one &amp; two</t><t>three</t></r>', 't')).toBe('one & two');
  });

  test('reads a CDATA section around spaces', () => {
    // Act / Assert
    expect(textOf('<v> <![CDATA[<p>Hi</p>]]> </v>', 'v')).toBe('<p>Hi</p>');
  });

  test('gives undefined when the element is absent or empty', () => {
    // Act / Assert
    expect(textOf('<r></r>', 't')).toBeUndefined();
    expect(textOf('<r><t></t></r>', 't')).toBeUndefined();
    expect(textOf('<r><t>  </t><t>x</t></r>', 't')).toBeUndefined();
  });
});
