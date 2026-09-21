import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOpml } from 'feedsmith';

// The catalog is user-facing metadata, so its source count must stay aligned with the OPML file.
const directory = 'feedpacks';
const index = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
const files = (await readdir(directory)).filter((file) => file.endsWith('.opml'));

if (index.version !== 1) {
  throw new Error(`Unsupported catalog version ${index.version}.`);
}

function xmlUrls(outlines) {
  // OPML folders can nest, while every leaf with xmlUrl is an installable source.
  return outlines.flatMap((outline) => [
    ...(outline.xmlUrl ? [outline.xmlUrl] : []),
    ...xmlUrls(outline.outlines ?? []),
  ]);
}

for (const pack of index.packs) {
  if (!files.includes(pack.opml)) {
    throw new Error(`${pack.slug} references missing ${pack.opml}.`);
  }
  const document = parseOpml(await readFile(join(directory, pack.opml), 'utf8'));
  const urls = xmlUrls(document.body?.outlines ?? []);
  if (urls.length !== pack.sourceCount) {
    throw new Error(`${pack.slug} has ${urls.length} sources, but index.json says ${pack.sourceCount}.`);
  }
  // A valid OPML URL can still rot. Follow redirects because many feed hosts use them.
  const responses = await Promise.all(urls.map((url) => fetch(url, { redirect: 'follow' })));
  const failed = urls.filter((_, index) => !responses[index]?.ok);
  if (failed.length > 0) {
    throw new Error(`${pack.slug} has unreachable sources: ${failed.join(', ')}.`);
  }
}
