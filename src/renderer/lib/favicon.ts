export function getFaviconUrl(link: string | undefined): string | undefined {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}
