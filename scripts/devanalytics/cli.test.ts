import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson, runCli, writeOutput } from './cli.mts';

const exitCode = process.exitCode;

afterEach(() => {
  process.exitCode = exitCode;
  vi.restoreAllMocks();
});

describe('runCli', () => {
  it('prints the error and the usage and sets the exit code', async () => {
    // Arrange
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Act
    runCli(() => Promise.reject(new Error('Missing file.')), 'Usage: tool <file>');

    // Assert
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(write).toHaveBeenCalledWith('Missing file.\nUsage: tool <file>\n');
  });

  it('prints a value that is not an Error', async () => {
    // Arrange
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Act
    runCli(() => Promise.reject('boom'), 'Usage: tool');

    // Assert
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith('boom\nUsage: tool\n'));
  });

  it('leaves the exit code alone when the entry point succeeds', async () => {
    // Arrange
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const main = vi.fn(() => Promise.resolve());

    // Act
    runCli(main, 'Usage: tool');
    await vi.waitFor(() => expect(main).toHaveBeenCalled());

    // Assert
    expect(process.exitCode).toBe(exitCode);
    expect(write).not.toHaveBeenCalled();
  });

  it('ends the process after stderr is flushed when `exit` is set', async () => {
    // Arrange
    const flushed: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(((text: string, callback: () => void) => {
      flushed.push(text);
      callback();
      return true;
    }) as typeof process.stderr.write);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    // Act
    runCli(() => Promise.reject(new Error('crash')), 'Usage: tool', { exit: true });

    // Assert
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(flushed).toEqual(['crash\nUsage: tool\n']);
    expect(process.exitCode).toBe(exitCode);
  });
});

describe('files', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'cli-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a JSON file', async () => {
    // Arrange
    const file = path.join(dir, 'in.json');
    await writeFile(file, '{"a":[1,2]}');

    // Act
    const result = await readJson(file);

    // Assert
    expect(result).toEqual({ a: [1, 2] });
  });

  it('writes the output to the file when one is given', async () => {
    // Arrange
    const file = path.join(dir, 'out.md');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Act
    await writeOutput(file, 'text\n');

    // Assert
    expect(await readFile(file, 'utf8')).toBe('text\n');
    expect(stdout).not.toHaveBeenCalled();
  });

  it('writes the output to stdout when there is no file', async () => {
    // Arrange
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Act
    await writeOutput(undefined, 'text\n');

    // Assert
    expect(stdout).toHaveBeenCalledWith('text\n');
  });
});
