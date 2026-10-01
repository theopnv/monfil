import { readFile, writeFile } from 'node:fs/promises';

const changelogPath = new URL('../src/content/docs/changelog.md', import.meta.url);
const outputPath = process.argv[2] ?? changelogPath;
const source = await readFile(changelogPath, 'utf8');
const firstSection = source.search(/^## v\S+/m);

if (firstSection === -1) {
  throw new Error('Changelog has no release sections');
}

const existingTags = new Set([...source.matchAll(/^## (v\S+)/gm)].map((match) => match[1]));
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'monfil-docs-build',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};
const releases = [];

for (let page = 1; ; page += 1) {
  const response = await fetch(`https://api.github.com/repos/theopnv/monfil/releases?per_page=100&page=${page}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status} ${response.statusText}`);
  }

  const batch = await response.json();
  releases.push(...batch);
  if (batch.length < 100) {
    break;
  }
}

const additions = releases
  .filter((release) => !release.draft && release.published_at && !existingTags.has(release.tag_name))
  .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
  .map((release) => {
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(release.published_at));
    const notes = (release.body?.trim() || 'See the release page for details.')
      .replace(/\r\n/g, '\n')
      .replace(/^#{1,5}(?=\s)/gm, (heading) => `${heading}#`);

    return `## ${release.tag_name} — ${date}\n\n${notes}\n\n[Release page](${release.html_url})\n\n`;
  });

if (additions.length > 0) {
  await writeFile(outputPath, `${source.slice(0, firstSection)}${additions.join('')}${source.slice(firstSection)}`);
}
