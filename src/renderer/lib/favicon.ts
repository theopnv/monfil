export function getFaviconUrl(link: string | undefined): string | undefined {
  if (!link) return undefined;
  try {
    return `${new URL(link).origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}
