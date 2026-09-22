import type { LogLevel } from './logging';

export type ErrorSurface = 'field' | 'toast' | 'section' | 'fatal';

export type ErrorPolicy<E extends { name: string }> = {
  [Name in E['name']]: {
    surface: ErrorSurface;
    level: LogLevel | 'none';
    message: string;
    retry: 'safe' | 'none';
  };
};
