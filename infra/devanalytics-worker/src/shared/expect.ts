/** A request body that fails validation. The router answers 400. */
export class ValidationError extends Error {
  override name = 'ValidationError';
}

export function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function expectText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1000) {
    throw new ValidationError(`${field} must be a string of 1 to 1000 characters`);
  }
  return value;
}

// Range checks belong to the table constraints, so a bad value fails the whole batch.
export function expectInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return value as number;
}

export function expectSha(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new ValidationError('sha must be a 40-character commit sha');
  }
  return value;
}

/** Converts a date to UTC ISO 8601, so that dates sort as text. */
export function expectDate(value: unknown): string {
  const text = expectText(value, 'date');
  const time = Date.parse(text);
  if (Number.isNaN(time)) {
    throw new ValidationError('date must be an ISO 8601 date');
  }
  return new Date(time).toISOString();
}
