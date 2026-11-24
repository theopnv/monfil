// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Breadcrumb, Event, Exception, StackFrame } from '@sentry/electron/main';

export const LOG_BREADCRUMB_CATEGORY = 'monfil.log';

export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'incidentId', 'logEvent', 'source', 'channel', 'outcome', 'requestedSurface', 'errorName', 'startup',
  'reason', 'event.process', 'event.origin', 'event.environment', 'process', 'handled', 'mechanism',
]);

const ALLOWED_BREADCRUMB_DATA: ReadonlySet<string> = new Set(['action', 'outcome', 'errorCode', 'channel', 'source', 'operation', 'requestedSurface', 'errorName']);

const ALLOWED_CONTEXT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  os: ['name', 'version', 'kernel_version'],
  device: ['arch'],
  runtime: ['name', 'version'],
  app: ['app_name', 'app_version'],
  browser: ['name', 'version'],
  chrome: ['name', 'version'],
  node: ['name', 'version'],
  electron: ['name', 'version'],
  feedback: ['message', 'associated_event_id'],
};

export interface ScrubPaths {
  homeDir: string;
  userDataDir: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches a directory with either separator, and with the doubled backslashes of a JSON string. */
function directoryPattern(directory: string): RegExp | undefined {
  const parts = directory.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  const lead = /^[\\/]/.test(directory) ? '[\\\\/]' : '';
  return new RegExp(`${lead}${parts.map(escapeRegExp).join('[\\\\/]+')}(?![\\w.-])`, 'gi');
}

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]]+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const OTHER_HOME_PATTERN = /(?:\/(?:Users|home)\/|[A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s"')]+/gi;

export interface Scrubber {
  string(value: string): string;
  event<E extends Event>(event: E): E;
  breadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null;
}

type Dictionary = Record<string, unknown>;

function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function createScrubber({ homeDir, userDataDir }: ScrubPaths): Scrubber {
  const userData = directoryPattern(userDataDir);
  const home = directoryPattern(homeDir);

  function scrubPath(value: string): string {
    let result = value;
    if (userData) {
      result = result.replace(userData, '<userData>');
    }
    if (home) {
      result = result.replace(home, '~');
    }
    return result.replace(OTHER_HOME_PATTERN, '~');
  }

  function scrubString(value: string): string {
    return scrubPath(value.replace(URL_PATTERN, '[url]').replace(EMAIL_PATTERN, '[email]'));
  }

  function scrubPrimitives(source: unknown, allowed: ReadonlySet<string> | readonly string[], clean = scrubString): Dictionary | undefined {
    if (!isDictionary(source)) {
      return undefined;
    }
    const keep = new Set(allowed);
    const entries = Object.entries(source)
      .filter(([key, value]) => keep.has(key) && isPrimitive(value))
      .map(([key, value]) => [key, typeof value === 'string' ? clean(value) : value]);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  function scrubFrame(frame: StackFrame): StackFrame {
    const kept: StackFrame = {};
    if (frame.filename !== undefined) {
      kept.filename = scrubPath(frame.filename);
    }
    if (frame.function !== undefined) {
      kept.function = scrubString(frame.function);
    }
    if (frame.module !== undefined) {
      kept.module = scrubString(frame.module);
    }
    if (frame.lineno !== undefined) {
      kept.lineno = frame.lineno;
    }
    if (frame.colno !== undefined) {
      kept.colno = frame.colno;
    }
    if (frame.in_app !== undefined) {
      kept.in_app = frame.in_app;
    }
    return kept;
  }

  function scrubException(exception: Exception): Exception {
    const kept: Exception = {};
    if (exception.type !== undefined) {
      kept.type = scrubString(exception.type);
    }
    if (exception.value !== undefined) {
      kept.value = scrubString(exception.value);
    }
    if (exception.mechanism) {
      const { type, handled } = exception.mechanism;
      kept.mechanism = { type, ...(handled === undefined ? {} : { handled }) };
    }
    if (exception.stacktrace?.frames) {
      kept.stacktrace = { frames: exception.stacktrace.frames.map(scrubFrame) };
    }
    return kept;
  }

  function scrubContexts(contexts: Event['contexts']): NonNullable<Event['contexts']> {
    const kept: NonNullable<Event['contexts']> = {};
    for (const [name, fields] of Object.entries(ALLOWED_CONTEXT_FIELDS)) {
      const context = scrubPrimitives(contexts?.[name], fields);
      if (context) {
        kept[name] = context as NonNullable<Event['contexts']>[string];
      }
    }
    return kept;
  }

  function scrubDebugMeta(debugMeta: Event['debug_meta']): Event['debug_meta'] {
    const images = (debugMeta?.images ?? []).flatMap((image) => {
      const entry = scrubPrimitives(image, ['type', 'debug_id', 'code_id', 'image_addr', 'image_size', 'code_file', 'debug_file'], scrubPath);
      return entry ? [entry] : [];
    });
    return images.length > 0 ? { images: images as unknown as NonNullable<NonNullable<Event['debug_meta']>['images']> } : undefined;
  }

  function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    if (breadcrumb.category !== LOG_BREADCRUMB_CATEGORY) {
      return null;
    }
    const data = scrubPrimitives(breadcrumb.data, ALLOWED_BREADCRUMB_DATA) as Breadcrumb['data'];
    return {
      category: breadcrumb.category,
      ...(breadcrumb.level ? { level: breadcrumb.level } : {}),
      ...(breadcrumb.message ? { message: scrubString(breadcrumb.message) } : {}),
      ...(breadcrumb.timestamp === undefined ? {} : { timestamp: breadcrumb.timestamp }),
      ...(data ? { data } : {}),
    };
  }

  function scrubEvent<E extends Event>(event: E): E {
    const kept: Event = {};
    for (const key of ['event_id', 'timestamp', 'platform', 'level', 'type', 'release', 'environment', 'dist', 'fingerprint'] as const) {
      if (event[key] !== undefined) {
        Object.assign(kept, { [key]: event[key] });
      }
    }
    if (event.message !== undefined) {
      kept.message = scrubString(event.message);
    }
    if (event.sdk?.name && event.sdk.version) {
      kept.sdk = { name: event.sdk.name, version: event.sdk.version };
    }
    const tags = scrubPrimitives(event.tags, ALLOWED_TAGS);
    if (tags) {
      kept.tags = tags as NonNullable<Event['tags']>;
    }
    kept.contexts = scrubContexts(event.contexts);
    if (event.exception?.values) {
      kept.exception = { values: event.exception.values.map(scrubException) };
    }
    const debugMeta = scrubDebugMeta(event.debug_meta);
    if (debugMeta) {
      kept.debug_meta = debugMeta;
    }
    if (event.breadcrumbs) {
      kept.breadcrumbs = event.breadcrumbs.flatMap((breadcrumb) => scrubBreadcrumb(breadcrumb) ?? []);
    }
    return kept as E;
  }

  return { string: scrubString, event: scrubEvent, breadcrumb: scrubBreadcrumb };
}
