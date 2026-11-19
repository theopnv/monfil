import type { Rule } from 'eslint';

const SIDE = { l: 's', r: 'e' } as const;
const CORNER = { tl: 'ss', tr: 'se', br: 'ee', bl: 'es' } as const;

const SPACING = /^(-?)(scroll-)?(m|p)([lr])-(.+)$/;
const INSET = /^(-?)(left|right)-(\d.*|\[.*|\(.*|px|auto|full)$/;
const ALIGN = /^(text|float|clear)-(left|right)$/;
const BORDER = /^(border|rounded)-([lr]|tl|tr|br|bl)(-.+)?$/;
const SLIDE = /^(slide-(?:in-from|out-to))-(left|right)(-.+)?$/;

function logicalToken(token: string): string | null {
  const spacing = SPACING.exec(token);
  if (spacing) {
    return `${spacing[1]}${spacing[2] ?? ''}${spacing[3]}${SIDE[spacing[4] as 'l' | 'r']}-${spacing[5]}`;
  }
  const inset = INSET.exec(token);
  if (inset) {
    return `${inset[1]}${inset[2] === 'left' ? 'start' : 'end'}-${inset[3]}`;
  }
  const align = ALIGN.exec(token);
  if (align) {
    return `${align[1]}-${align[2] === 'left' ? 'start' : 'end'}`;
  }
  const border = BORDER.exec(token);
  if (border) {
    const side = border[2] as keyof typeof SIDE | keyof typeof CORNER;
    const logical = side in SIDE ? SIDE[side as keyof typeof SIDE] : CORNER[side as keyof typeof CORNER];
    return `${border[1]}-${logical}${border[3] ?? ''}`;
  }
  const slide = SLIDE.exec(token);
  if (slide) {
    return `${slide[1]}-${slide[2] === 'left' ? 'start' : 'end'}${slide[3] ?? ''}`;
  }
  return null;
}

/** Splits `hover:!ml-2` into its variant prefix and the utility, and finds where the utility starts. */
function splitVariants(token: string): { prefix: string; utility: string } {
  let depth = 0;
  let cut = 0;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === ':' && depth === 0) {
      cut = index + 1;
    }
  }
  const rest = token.slice(cut);
  const important = rest.startsWith('!') ? 1 : 0;
  return { prefix: token.slice(0, cut + important), utility: rest.slice(important) };
}

/** The logical class that replaces a physical Tailwind class, or null when the class is fine. */
export function physicalClassSuggestion(token: string): string | null {
  const { prefix, utility } = splitVariants(token);
  const logical = logicalToken(utility);
  return logical === null ? null : `${prefix}${logical}`;
}

/** Bans Tailwind classes that name a screen side, because they do not flip in right-to-left layouts. */
export const physicalTailwindClassRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      physical: 'Use the logical class `{{ suggestion }}` instead of `{{ token }}`, so the layout flips in right-to-left languages.',
    },
    schema: [],
  },
  create(context) {
    function check(node: Rule.Node, text: string): void {
      for (const token of text.split(/\s+/)) {
        const suggestion = token === '' ? null : physicalClassSuggestion(token);
        if (suggestion !== null) {
          context.report({ node, messageId: 'physical', data: { token, suggestion } });
        }
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
        }
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
