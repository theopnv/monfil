import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

/**
 * Runs a CLI entry point and prints its error with the usage text.
 * `exit` ends the process once stderr is flushed, for a CLI whose child process pipes keep Node alive after a crash.
 */
export function runCli(main: () => Promise<void>, usage: string, options: { exit?: boolean } = {}): void {
  main().catch((error: unknown) => {
    const text = `${error instanceof Error ? error.message : String(error)}\n${usage}\n`;
    if (options.exit) {
      process.stderr.write(text, () => process.exit(1));
      return;
    }
    process.stderr.write(text);
    process.exitCode = 1;
  });
}

export async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Writes to `file`, or to stdout when there is none. */
export async function writeOutput(file: string | undefined, text: string): Promise<void> {
  if (file) {
    await writeFile(file, text);
  } else {
    process.stdout.write(text);
  }
}
