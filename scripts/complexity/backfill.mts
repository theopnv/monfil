import { backfill } from '../devanalytics/backfill.mts';
import { runCli } from '../devanalytics/cli.mts';
import { snapshot } from './metrics.mts';

const USAGE = 'Usage: npm run complexity:backfill -- [--dry-run --out-dir <dir>] [<tag> ...]';

runCli(() => backfill({
  name: 'complexity',
  route: '/complexity/ingest',
  async measure(worktree) {
    const { snapshot: result, warnings } = await snapshot(worktree);
    return { snapshot: result, detail: `${result.functions.length} functions, ${warnings.length} warnings` };
  },
}), USAGE);
