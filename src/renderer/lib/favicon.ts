export function getFaviconUrl(link: string | undefined): string | undefined {
  if (!link) {
    return undefined;
  }
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    if (url.hostname.split('.').length > 2) {
      const domainParts = url.hostname.split('.');
      const rootDomain = domainParts.slice(-2).join('.');
      return `${url.protocol}//${rootDomain}/favicon.ico`;
    }
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}
