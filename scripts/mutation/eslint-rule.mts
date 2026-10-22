import type { Rule } from 'eslint';

const DIRECTIVE = /^\s*Stryker\s+disable\b(.*)$/s;
const NEXT_LINE = /^\s+next-line\s+([^:\s]+)\s*(?::(.*))?$/s;

/** Checks one `Stryker disable` comment and gives the id of the message to report, or null. */
export function strykerDisableProblem(text: string): 'nextLine' | 'all' | 'reason' | null {
  const directive = DIRECTIVE.exec(text);
  if (!directive) {
    return null;
  }
  const nextLine = NEXT_LINE.exec(directive[1] ?? '');
  if (!nextLine) {
    return 'nextLine';
  }
  if ((nextLine[1] ?? '').split(',').some((mutator) => mutator.trim().toLowerCase() === 'all')) {
    return 'all';
  }
  return (nextLine[2] ?? '').trim() === '' ? 'reason' : null;
}

/** Keeps each mutant suppression to one line, named mutators and a written reason. */
export const strykerDisableRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    messages: {
      nextLine: 'Use `Stryker disable next-line <mutator>: <reason>`. A range disable hides every later mutant of the file.',
      all: 'Name the mutators to disable. `all` also hides mutants that a test could kill.',
      reason: 'Give the reason after a colon: why no test can kill this mutant.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const problem = strykerDisableProblem(comment.value);
          if (problem) {
            context.report({ loc: comment.loc ?? { line: 1, column: 0 }, messageId: problem });
          }
        }
      },
    };
  },
};
