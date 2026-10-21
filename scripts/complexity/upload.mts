import process from 'node:process';
import type { Snapshot } from './metrics.mts';

export interface UploadTarget {
  url: string;
  token: string;
}

/** Reads the Worker URL and ingest token from `COMPLEXITY_WORKER_URL` and `COMPLEXITY_INGEST_TOKEN`. */
export function uploadTarget(env: NodeJS.ProcessEnv = process.env): UploadTarget {
  const url = env['COMPLEXITY_WORKER_URL'];
  const token = env['COMPLEXITY_INGEST_TOKEN'];
  if (!url || !token) {
    throw new Error('Set COMPLEXITY_WORKER_URL and COMPLEXITY_INGEST_TOKEN to upload a snapshot.');
  }
  return { url: url.replace(/\/+$/, ''), token };
}

/** Sends a snapshot to `POST /ingest`, which replaces every row of its sha. */
export async function upload(target: UploadTarget, snapshot: Snapshot): Promise<unknown> {
  const response = await fetch(`${target.url}/ingest`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${target.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Ingest of ${snapshot.sha} failed with ${response.status}: ${body}`);
  }
  return JSON.parse(body);
}
