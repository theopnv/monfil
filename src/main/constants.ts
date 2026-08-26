// Fixed values that tune the app's behavior. Unlike `settings.ts`, none of these are user-facing:
// there is no IPC channel or UI control for them, and they are not meant to grow one.

export const DB_FILE_NAME = 'monfil.db';

export const FEED_FETCH_CONCURRENCY = 4;
export const ENRICHMENT_CONCURRENCY = 5;
export const ARTICLE_FETCH_TIMEOUT_MS = 5000;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_FETCH_BYTES = 10 * 1024 * 1024;

// Cookie walls and paywall stubs extract "successfully" but too thin to be worth showing over the feed description.
export const MIN_ARTICLE_LENGTH = 500;
