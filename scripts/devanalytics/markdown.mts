/** The most rows that a table of a PR comment shows. */
export const MAX_ROWS = 15;

const MAX_CODE_LENGTH = 120;
// Line breaks, other control characters, and bidirectional overrides that could hide text.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Shows untrusted text as a code span, where GitHub renders no links, mentions or HTML.
 * A pipe would end the table cell even inside a code span, so it becomes a similar character.
 */
export function codeSpan(text: string): string {
  let clean = text.replace(UNSAFE_CHARACTERS, ' ').replaceAll('|', '∣');
  if (clean.length > MAX_CODE_LENGTH) {
    clean = `${clean.slice(0, MAX_CODE_LENGTH - 1)}…`;
  }
  const longestRun = Math.max(0, ...(clean.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  return `${fence} ${clean} ${fence}`;
}
