import { hasToken } from './auth.ts';
import { ingest, parseQuery, QueryError, runQuery } from './db.ts';
import { parseSnapshot, SnapshotError } from './snapshot.ts';

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SnapshotError('body must be JSON');
  }
}

async function handleIngest(request: Request, env: Env): Promise<Response> {
  if (!(await hasToken(request, env.INGEST_TOKEN))) {
    return json({ error: 'unauthorized' }, 401);
  }
  const snapshot = parseSnapshot(await readJson(request));
  return json({ sha: snapshot.sha, ...(await ingest(env.DB, snapshot)) });
}

async function handleQuery(request: Request, env: Env): Promise<Response> {
  if (!(await hasToken(request, env.QUERY_TOKEN))) {
    return json({ error: 'unauthorized' }, 401);
  }
  return json(await runQuery(env.DB, parseQuery(await readJson(request))));
}

const ROUTES: Record<string, (request: Request, env: Env) => Promise<Response>> = {
  '/ingest': handleIngest,
  '/query': handleQuery,
};

function errorResponse(error: unknown): Response {
  if (error instanceof SnapshotError || error instanceof QueryError) {
    return json({ error: error.message }, 400);
  }
  // D1 errors carry the SQLite message, such as a failed CHECK or a syntax error.
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: message }, 422);
}

export default {
  async fetch(request, env): Promise<Response> {
    const route = ROUTES[new URL(request.url).pathname];
    if (!route) {
      return json({ error: 'not found' }, 404);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }
    try {
      return await route(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;
