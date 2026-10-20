import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const repo = 'theopnv/monfil';
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

async function github(path, init) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers, ...init });
  if (!response.ok) {
    throw new Error(`GitHub request ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const releases = new Map();

for (let page = 1; ; page += 1) {
  const batch = await github(`/releases?per_page=100&page=${page}`);
  for (const release of batch) {
    if (!release.draft && release.published_at) {
      releases.set(release.tag_name, release);
    }
  }
  if (batch.length < 100) {
    break;
  }
}

// Old releases are deleted after each publish but their tags are kept, so tags are the source of truth.
const tags = execFileSync(
  'git',
  ['for-each-ref', '--sort=creatordate', '--format=%(refname:short) %(creatordate:iso-strict)', 'refs/tags/v*'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [name, date] = line.split(' ');
    return { name, date };
  });

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const additions = [];

for (const [index, tag] of tags.entries()) {
  if (existingTags.has(tag.name)) {
    continue;
  }

  const release = releases.get(tag.name);
  let body;
  let date;
  let link = '';

  if (release) {
    body = release.body;
    date = release.published_at;
    link = `[Release page](${release.html_url})\n\n`;
  } else {
    const previous = tags[index - 1];
    const generated = await github('/releases/generate-notes', {
      method: 'POST',
      body: JSON.stringify({ tag_name: tag.name, ...(previous ? { previous_tag_name: previous.name } : {}) }),
    });
    body = generated.body;
    date = tag.date;
  }

  const notes = (body?.trim() || 'See the release page for details.')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,5}(?=\s)/gm, (heading) => `${heading}#`);

  additions.push({
    date,
    text: `## ${tag.name} — ${dateFormat.format(new Date(date))}\n\n${notes}\n\n${link}`,
  });
}

additions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

if (additions.length > 0) {
  await writeFile(
    outputPath,
    `${source.slice(0, firstSection)}${additions.map((addition) => addition.text).join('')}${source.slice(firstSection)}`,
  );
}
