import process from 'node:process';
import type { ApiJob, ApiRun } from './snapshot.mts';

export interface GithubTarget {
  apiUrl: string;
  repository: string;
  token: string;
}

const PAGE_SIZE = 100;

/** Reads the repository and token from the variables that GitHub Actions sets. The token needs `actions: read`. */
export function githubTarget(env: NodeJS.ProcessEnv = process.env): GithubTarget {
  const repository = env['GITHUB_REPOSITORY'];
  const token = env['GITHUB_TOKEN'];
  if (!repository || !token) {
    throw new Error('Set GITHUB_REPOSITORY and GITHUB_TOKEN to read a workflow run.');
  }
  return { apiUrl: (env['GITHUB_API_URL'] || 'https://api.github.com').replace(/\/+$/, ''), repository, token };
}

async function get(target: GithubTarget, route: string): Promise<unknown> {
  const response = await fetch(`${target.apiUrl}/repos/${target.repository}${route}`, {
    headers: {
      'Authorization': `Bearer ${target.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for ${route}: ${await response.text()}`);
  }
  return response.json();
}

/** Reads the plain text log of one job. GitHub answers with a redirect to a signed address. */
export async function fetchJobLog(target: GithubTarget, jobId: number): Promise<string> {
  const response = await fetch(`${target.apiUrl}/repos/${target.repository}/actions/jobs/${jobId}/logs`, {
    headers: { 'Authorization': `Bearer ${target.token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for the log of job ${jobId}.`);
  }
  return response.text();
}

export async function fetchRun(target: GithubTarget, runId: number, attempt: number): Promise<ApiRun> {
  return await get(target, `/actions/runs/${runId}/attempts/${attempt}`) as ApiRun;
}

/** Reads every page of the jobs of one attempt. */
export async function fetchJobs(target: GithubTarget, runId: number, attempt: number): Promise<ApiJob[]> {
  const jobs: ApiJob[] = [];
  for (let page = 1; ; page += 1) {
    const body = await get(target, `/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=${PAGE_SIZE}&page=${page}`) as { jobs: ApiJob[] };
    jobs.push(...body.jobs);
    if (body.jobs.length < PAGE_SIZE) {
      return jobs;
    }
  }
}
