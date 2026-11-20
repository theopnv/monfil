export function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function expectCount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

export function expectString(value: unknown, field: string, options: { nonEmpty?: boolean } = {}): string {
  if (typeof value !== 'string' || (options.nonEmpty && value.length === 0)) {
    throw new Error(`${field} must be a ${options.nonEmpty ? 'non-empty ' : ''}string`);
  }
  return value;
}

export function expectSha(value: unknown, field: string): string {
  const sha = expectString(value, field);
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`${field} must be a commit sha`);
  }
  return sha;
}
