import { createHash } from 'node:crypto';
import { decode, EntityLevel } from 'entities';

// Some feeds put literal entities like "&#8217;" inside a CDATA section, where XML parsers
// leave them untouched by spec. Decode them here so titles and descriptions render as text.
export function decodeText(text: string): string {
  return decode(text, EntityLevel.HTML);
}

export function decodeOptional(text: string | undefined): string | undefined {
  return text === undefined ? undefined : decodeText(text);
}

// Every item needs an identity, and a feed may supply neither a guid nor a link, so fall back to a
// digest of the fields that are always there. The prefix keeps it clear of real guids.
export function resolveGuid(guid: string | undefined, link: string | undefined, title: string, pubDate: string): string {
  if (guid) {
    return guid;
  }
  if (link) {
    return link;
  }
  return `monfil:hash:${createHash('sha1').update(`${title} ${pubDate}`).digest('hex')}`;
}
