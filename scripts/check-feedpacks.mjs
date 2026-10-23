// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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
}

const atsHost = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|recruitee\.com|teamtailor\.com|personio\.(com|de))$/;
const probeTimeoutMs = 30_000;
const probeConcurrency = 6;

function isAtsUrl(url) {
  try {
    return atsHost.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function jobCount(body) {
  try {
    const json = JSON.parse(body);
    const list = Array.isArray(json) ? json : json.jobs ?? json.offers ?? json.content;
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return body.split(/<item>|<position>/).length - 1;
  }
}

// A 404 means the board is gone and the pack would install a dead feed. Network trouble and empty boards only warn, so a flaky run or a company with no open job does not block a release.
async function probeBoard(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(probeTimeoutMs), headers: { 'user-agent': 'monfil-feedpack-check' } });
    if (response.status === 404 || response.status === 410) {
      return { level: 'error', message: `${url} returned ${response.status}.` };
    }
    if (!response.ok) {
      return { level: 'warn', message: `${url} returned ${response.status}.` };
    }
    return jobCount(await response.text()) === 0 ? { level: 'warn', message: `${url} has no open job.` } : undefined;
  } catch (error) {
    return { level: 'warn', message: `${url} could not be probed: ${error instanceof Error ? error.message : String(error)}.` };
  }
}

async function probeAll(urls) {
  const outcomes = [];
  const queue = [...urls];
  await Promise.all(Array.from({ length: probeConcurrency }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const outcome = await probeBoard(url);
      if (outcome) {
        outcomes.push(outcome);
      }
    }
  }));
  return outcomes;
}

if (!process.argv.includes('--no-probe')) {
  const boards = new Set();
  for (const pack of index.packs) {
    const document = parseOpml(await readFile(join(directory, pack.opml), 'utf8'));
    xmlUrls(document.body?.outlines ?? []).filter(isAtsUrl).forEach((url) => boards.add(url));
  }
  const outcomes = await probeAll(boards);
  for (const outcome of outcomes.filter((candidate) => candidate.level === 'warn')) {
    console.warn(`warning: ${outcome.message}`);
  }
  const errors = outcomes.filter((outcome) => outcome.level === 'error');
  if (errors.length > 0) {
    throw new Error(`Dead job boards:\n${errors.map((outcome) => outcome.message).join('\n')}`);
  }
  console.log(`Probed ${boards.size} job boards.`);
}
