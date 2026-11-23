// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { observeLogs } from '../logging/logger';
import { shortIncidentId } from '../logging/incident';
import type { LogEventMap, LogEventName, LogLevel } from '../../shared/logging';
import type { Caps } from './caps';
import { rememberReportedEvent } from './incidents';

export type ReportLevel = 'warning' | 'error';

export interface ErrorReport {
  error: Error | undefined;
  message: string;
  level: ReportLevel;
  tags: Record<string, string>;
  /** False for a failure that ends the process or a window, so the session counts as crashed. */
  handled: boolean;
  /** Set only when there is no stack trace to group by. */
  fingerprint?: string[];
}

export interface Breadcrumb {
  event: LogEventName;
  level: LogLevel;
  data: Record<string, string>;
}

/** What the routing needs from the error tracker, so a test can stand in for it. */
export interface ReportSink {
  breadcrumb: (breadcrumb: Breadcrumb) => void;
  capture: (report: ErrorReport) => string | undefined;
}

interface Routed {
  tags: Record<string, string>;
  level: ReportLevel;
  handled?: boolean;
  /** Tells apart two failures of one event. It stays on the device and is never sent. */
  discriminator: string;
}

const KNOWN_FEED_OUTCOMES: ReadonlySet<string> = new Set([
  'NETWORK_ERROR', 'GENERIC_FETCH_ERROR', 'NOT_ALLOWED_OR_ABORTED_ERROR', 'RESPONSE_TOO_LARGE_ERROR', 'BLOCKED_URL_ERROR', 'PARSE_ERROR', 'UNSUPPORTED_FORMAT',
]);

function defined(tags: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(tags).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function incident(incidentId: string | undefined): string | undefined {
  return incidentId ? shortIncidentId(incidentId) : undefined;
}

const PROCESS_EXIT_REASONS: ReadonlySet<string> = new Set([
  'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed', 'integrity-failure', 'memory-eviction',
]);

/** Electron says why a process went away in the `reason` of its details. Only the known values leave the device. */
function exitReason(details: unknown): string | undefined {
  const reason = typeof details === 'object' && details !== null && 'reason' in details ? details.reason : undefined;
  return typeof reason === 'string' && PROCESS_EXIT_REASONS.has(reason) ? reason : undefined;
}

type Router<E extends LogEventName> = (data: LogEventMap[E], rawError: unknown) => Routed | undefined;

const routers: { [E in LogEventName]?: Router<E> } = {
  'system.failure': ({ source, incidentId }, rawError) => (
    { tags: defined({ source, incidentId: incident(incidentId), reason: exitReason(rawError) }), level: 'error', handled: false, discriminator: source }
  ),
  'renderer.failure': ({ message, incidentId }) => ({ tags: defined({ incidentId: incident(incidentId) }), level: 'error', discriminator: message }),
  'ipc.failure': ({ channel, incidentId }) => ({ tags: defined({ channel, incidentId: incident(incidentId) }), level: 'error', discriminator: channel }),
  'database.recovery': ({ outcome, incidentId }) => (
    { tags: defined({ outcome, incidentId: incident(incidentId) }), level: outcome === 'failed' ? 'error' : 'warning', discriminator: outcome }
  ),
  'framework.fallback': ({ requestedSurface, errorName }) => ({ tags: { requestedSurface, errorName }, level: 'warning', discriminator: `${requestedSurface}:${errorName}` }),
  'app.update': ({ outcome }) => (outcome === 'failed' ? { tags: { outcome }, level: 'warning', discriminator: outcome } : undefined),
  'feed.refresh': ({ errorCode }) => (
    errorCode !== undefined && KNOWN_FEED_OUTCOMES.has(errorCode)
      ? undefined
      : { tags: errorCode ? { errorName: errorCode } : {}, level: 'error', discriminator: errorCode ?? 'none' }
  ),
};

function routeEvent(event: LogEventName, data: LogEventMap[LogEventName], rawError: unknown): Routed | undefined {
  return (routers[event] as Router<LogEventName> | undefined)?.(data, rawError);
}

/** The enum-like fields of a log record. It leaves out every ID, message and link. */
export function breadcrumbData(event: LogEventName, data: LogEventMap[LogEventName]): Record<string, string> {
  switch (event) {
    case 'app.lifecycle': return { action: (data as LogEventMap['app.lifecycle']).action };
    case 'app.update': return { outcome: (data as LogEventMap['app.update']).outcome };
    case 'app.analytics': return { outcome: (data as LogEventMap['app.analytics']).outcome };
    case 'database.recovery': return { outcome: (data as LogEventMap['database.recovery']).outcome };
    case 'feed.refresh': return defined({ outcome: (data as LogEventMap['feed.refresh']).outcome, errorCode: (data as LogEventMap['feed.refresh']).errorCode });
    case 'ipc.failure': return { channel: (data as LogEventMap['ipc.failure']).channel };
    case 'system.failure': return { source: (data as LogEventMap['system.failure']).source };
    case 'operation.failure': return { operation: (data as LogEventMap['operation.failure']).operation };
    case 'framework.fallback': return { requestedSurface: (data as LogEventMap['framework.fallback']).requestedSurface, errorName: (data as LogEventMap['framework.fallback']).errorName };
    default: return {};
  }
}

function isCodedError(value: unknown): value is { name: string; message: string } {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'message' in value && typeof value.message === 'string';
}

/** Gives the tracker an Error to read a stack from. A renderer sends its error as text, and a failed fetch is a plain object. */
export function toError(value: unknown): Error | undefined {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const [head = '', ...rest] = value.split('\n');
    const separator = head.indexOf(': ');
    const error = new Error(separator === -1 ? head : head.slice(separator + 2));
    error.name = separator === -1 ? 'Error' : head.slice(0, separator);
    error.stack = rest.length > 0 ? `${head}\n${rest.join('\n')}` : head;
    return error;
  }
  if (isCodedError(value)) {
    const error = new Error(value.message);
    error.name = value.name;
    return error;
  }
  return undefined;
}

/** Names the place of a failure without a path or a line number, so the same bug has one fingerprint on every machine. */
function topFrame(error: Error | undefined): string {
  const line = error?.stack?.split('\n').find((candidate) => candidate.trimStart().startsWith('at '));
  if (!line) {
    return '';
  }
  const body = line.trim().slice(3);
  const named = /^(.*?) \(.*\)$/.exec(body);
  return named?.[1] ?? body.replace(/:\d+(?::\d+)?$/, '').split(/[\\/]/).pop() ?? '';
}

export interface RoutingOptions {
  sink: ReportSink;
  caps: Caps;
  isStartingUp: () => boolean;
}

/** Sends the failures of the app to the error tracker, and keeps a trail of the other log records that come before them. */
export function startErrorRouting({ sink, caps, isStartingUp }: RoutingOptions): () => void {
  return observeLogs((event, data, level, rawError) => {
    const routed = routeEvent(event, data, rawError);
    if (!routed) {
      if (level !== 'debug') {
        sink.breadcrumb({ event, level, data: breadcrumbData(event, data) });
      }
      return;
    }
    const error = toError(rawError);
    const fingerprint = [event, routed.discriminator, error?.name ?? '', topFrame(error)].join('|');
    void caps.accept(fingerprint).then((accepted) => {
      if (!accepted) {
        return;
      }
      const tags = { logEvent: event, ...routed.tags, ...(isStartingUp() ? { startup: 'true' } : {}) };
      const eventId = sink.capture({
        error,
        message: event,
        level: routed.level,
        tags,
        handled: routed.handled ?? true,
        ...(error ? {} : { fingerprint: [event, ...Object.entries(routed.tags).filter(([name]) => name !== 'incidentId').map(([, value]) => value)] }),
      });
      if (eventId) {
        rememberReportedEvent(routed.tags['incidentId'], eventId);
      }
    });
  });
}
