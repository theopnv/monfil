export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEventMap {
  'app.lifecycle': { action: string };
  'database.recovery': { outcome: 'reset' | 'failed'; incidentId?: string };
  'feed.refresh': { outcome: 'failed'; feedId?: number; errorCode?: string };
  'ipc.failure': { channel: string; incidentId: string };
  'renderer.failure': { message: string; incidentId?: string };
  'system.failure': { source: string; incidentId: string };
  'operation.failure': { operation: string; entityId?: number };
  'framework.fallback': { requestedSurface: string; errorName: string };
}

export type LogEventName = keyof LogEventMap;

export interface LogRecord<E extends LogEventName = LogEventName> {
  level: LogLevel;
  event: E;
  scope: string;
  timestamp: string;
  data: LogEventMap[E];
  error?: { name: string; message: string; stack?: string };
}
