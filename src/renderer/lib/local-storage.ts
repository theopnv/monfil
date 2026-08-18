/**
 * Reads and JSON-parses a localStorage value.
 * @returns The parsed value, or `undefined` if the key is missing or the value isn't valid JSON.
 */
export function readLocalStorageJSON(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** JSON-stringifies and writes a value to localStorage. */
export function writeLocalStorageJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
