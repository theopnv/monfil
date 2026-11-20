import process from 'node:process';

export interface UploadTarget {
  url: string;
  token: string;
}

// The Worker is public, so its address is not a secret. DEVANALYTICS_WORKER_URL overrides it, for a local Worker.
const DEFAULT_WORKER_URL = 'https://monfil-devanalytics.tpenavaire.workers.dev';

/** Reads the ingest token from `DEVANALYTICS_INGEST_TOKEN`, and the Worker URL from `DEVANALYTICS_WORKER_URL` when it is set. */
export function uploadTarget(env: NodeJS.ProcessEnv = process.env): UploadTarget {
  const url = env['DEVANALYTICS_WORKER_URL'] || DEFAULT_WORKER_URL;
  const token = env['DEVANALYTICS_INGEST_TOKEN'];
  if (!token) {
    throw new Error('Set DEVANALYTICS_INGEST_TOKEN to upload a snapshot.');
  }
  return { url: url.replace(/\/+$/, ''), token };
}

/** Sends a snapshot to an ingest route such as `/complexity/ingest`, which replaces every row of its sha. */
export async function upload(target: UploadTarget, route: string, snapshot: { sha: string }): Promise<unknown> {
  const response = await fetch(`${target.url}${route}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Ingest of ${snapshot.sha} on ${route} failed with ${response.status}: ${body}`);
  }
  return JSON.parse(body);
}
