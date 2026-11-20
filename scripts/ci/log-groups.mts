import { stripVTControlCharacters } from 'node:util';

export interface LogGroup {
  name: string;
  duration_ms: number;
}

/** Shorter groups are noise, and a job log has about a hundred of them. */
export const MIN_GROUP_MS = 1000;
export const MAX_GROUPS = 200;
const MAX_NAME = 200;

// Each log line starts with a UTC timestamp that has seven fractional digits. A byte order mark can precede the first one.
const LINE = /^\uFEFF?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z (.*)$/;
const GROUP = '##[group]';
const ACTION_SHA = /@[0-9a-f]{40}\b/g;

function toMilliseconds(seconds: string, fraction = ''): number {
  return Date.parse(`${seconds}.${`${fraction}000`.slice(0, 3)}Z`);
}

/** Drops the commit sha that pins an action, so that a version bump does not start a new series on the dashboard. */
function cleanName(text: string): string {
  return stripVTControlCharacters(text).replace(ACTION_SHA, '').trim().slice(0, MAX_NAME);
}

/**
 * Splits the log of a job at its `##[group]` lines. A group lasts until the next group starts, or until the last line of the log,
 * because the output of a step comes after its closed group. The log comes from code that a pull request controls,
 * so a line that does not look like a log line is ignored and the result is capped.
 */
export function parseLogGroups(log: string, minimumMs: number = MIN_GROUP_MS): LogGroup[] {
  const groups: LogGroup[] = [];
  let open: { name: string; start: number } | undefined;
  let last = Number.NaN;
  const close = (end: number) => {
    const duration = end - (open?.start ?? Number.NaN);
    if (open && open.name && duration >= minimumMs) {
      groups.push({ name: open.name, duration_ms: duration });
    }
  };
  for (const line of log.split('\n')) {
    const match = LINE.exec(line.endsWith('\r') ? line.slice(0, -1) : line);
    if (!match) {
      continue;
    }
    last = toMilliseconds(match[1] as string, match[2]);
    const text = match[3] as string;
    if (text.startsWith(GROUP)) {
      close(last);
      open = { name: cleanName(text.slice(GROUP.length)), start: last };
    }
  }
  close(last);
  return groups.slice(0, MAX_GROUPS);
}
