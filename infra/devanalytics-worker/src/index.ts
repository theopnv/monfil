import { ingestComplexity } from './complexity/db.ts';
import { parseSnapshot } from './complexity/snapshot.ts';
import { readCoverageBadge } from './coverage/badge.ts';
import { ingestCoverage } from './coverage/db.ts';
import { parseCoverageSnapshot } from './coverage/snapshot.ts';
import { hasToken } from './shared/auth.ts';
import { ValidationError } from './shared/expect.ts';
import { parseQuery, QueryError, runQuery } from './shared/query.ts';
import { COMPLEXITY_TABLES, COVERAGE_TABLES } from './shared/tables.ts';

const json = (body: unknown, status = 200) => Response.json(body, { status });

type Handler = (request: Request, env: Env) => Promise<Response>;

interface Route {
  method: 'GET' | 'POST';
  handle: Handler;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('body must be JSON');
  }
}

function ingestRoute<T extends { sha: string }>(
  parse: (body: unknown) => T,
  store: (db: D1Database, snapshot: T) => Promise<object>,
): Handler {
  return async (request, env) => {
    if (!(await hasToken(request, env.INGEST_TOKEN))) {
      return json({ error: 'unauthorized' }, 401);
    }
    const snapshot = parse(await readJson(request));
    return json({ sha: snapshot.sha, ...(await store(env.DB, snapshot)) });
  };
}

function queryRoute(allowedTables: readonly string[]): Handler {
  return async (request, env) => {
    if (!(await hasToken(request, env.QUERY_TOKEN))) {
      return json({ error: 'unauthorized' }, 401);
    }
    return json(await runQuery(env.DB, parseQuery(await readJson(request), allowedTables)));
  };
}

/** Public and read-only: shields.io fetches it without a token, so it runs one fixed query and reads nothing from the request. */
const coverageBadgeRoute: Handler = async (_request, env) => Response.json(await readCoverageBadge(env.DB), {
  headers: { 'Cache-Control': 'public, max-age=3600' },
});

const ROUTES: Record<string, Route> = {
  '/complexity/ingest': { method: 'POST', handle: ingestRoute(parseSnapshot, ingestComplexity) },
  '/complexity/query': { method: 'POST', handle: queryRoute(COMPLEXITY_TABLES) },
  '/coverage/ingest': { method: 'POST', handle: ingestRoute(parseCoverageSnapshot, ingestCoverage) },
  '/coverage/query': { method: 'POST', handle: queryRoute(COVERAGE_TABLES) },
  '/coverage/badge': { method: 'GET', handle: coverageBadgeRoute },
};

function errorResponse(error: unknown): Response {
  if (error instanceof ValidationError || error instanceof QueryError) {
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
    if (request.method !== route.method) {
      return json({ error: 'method not allowed' }, 405);
    }
    try {
      return await route.handle(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;
