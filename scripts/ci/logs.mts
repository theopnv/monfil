import { fetchJobLog, type GithubTarget } from './github.mts';
import { parseLogGroups, type LogGroup } from './log-groups.mts';
import type { ApiJob } from './snapshot.mts';

type LogReader = (target: GithubTarget, jobId: number) => Promise<string>;

/**
 * Reads the log groups of every job that started, by job id. A log that cannot be read gives a warning and no groups,
 * so a missing log never stops the ingest of the timings.
 */
export async function loadLogGroups(
  target: GithubTarget,
  jobs: ApiJob[],
  warn: (message: string) => void,
  readLog: LogReader = fetchJobLog,
): Promise<Map<number, LogGroup[]>> {
  const groups = new Map<number, LogGroup[]>();
  await Promise.all(jobs.filter((job) => job.started_at).map(async (job) => {
    try {
      groups.set(job.id, parseLogGroups(await readLog(target, job.id)));
    } catch (error) {
      warn(`Skipped the log of job ${job.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  return groups;
}
