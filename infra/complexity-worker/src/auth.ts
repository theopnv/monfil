const encoder = new TextEncoder();

async function digest(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(text));
}

/**
 * Checks a `Bearer` token in constant time. Hashing both sides first gives equal lengths,
 * which `timingSafeEqual` needs, and hides the length of the expected token.
 */
export async function hasToken(request: Request, expected: string | undefined): Promise<boolean> {
  if (!expected) {
    return false;
  }
  const header = request.headers.get('Authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}
