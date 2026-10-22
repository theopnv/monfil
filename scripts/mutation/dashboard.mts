import type { MutationSuite } from './targets.mts';

export const DASHBOARD_PROJECT = 'github.com/theopnv/monfil';
const REPORTS_API = 'https://dashboard.stryker-mutator.io/api/reports';

/** The report URL of one version and suite. The dashboard shows each suite as a module of the version. */
export function reportUrl(version: string, suite: MutationSuite): string {
  return `${REPORTS_API}/${DASHBOARD_PROJECT}/${encodeURIComponent(version)}?module=${encodeURIComponent(suite)}`;
}

/** Sends a full JSON report to the Stryker dashboard and gives the address of its page. */
export async function uploadReport(report: string, version: string, suite: MutationSuite, apiKey: string): Promise<string> {
  const url = reportUrl(version, suite);
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: report,
  });
  const body = await response.text();
  if (response.status === 401) {
    throw new Error(`The dashboard refused the API key for ${url}. Check STRYKER_DASHBOARD_API_KEY.`);
  }
  if (!response.ok) {
    throw new Error(`The upload to ${url} failed with ${response.status}: ${body}`);
  }
  return (JSON.parse(body) as { href: string }).href;
}
