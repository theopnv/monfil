// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type {
  OneWayMainToRendererChannelPayloads,
  OneWayMainToRendererChannels,
  OneWayRendererToMainChannelPayloads,
  OneWayRendererToMainChannels,
  SettingKey,
  SettingTypes,
} from '../../shared/channels';
import type { ArgOf, InvokeChannel, ResultOf } from '../../shared/ipc-schema';
import { isIpcFailure } from '../../shared/result';
import type { LogEventMap, LogEventName, LogLevel } from '../../shared/logging';

type PlainChannel = Exclude<InvokeChannel, 'settings:get' | 'settings:set'>;

/** A channel that takes no argument is called with the channel name alone. */
type ArgsOf<C extends InvokeChannel> = [ArgOf<C>] extends [undefined] ? [] : [arg: ArgOf<C>];

interface Invoke {
  <K extends SettingKey>(channel: 'settings:get', arg: { key: K }): Promise<SettingTypes[K]['state']>;
  <K extends SettingKey>(channel: 'settings:set', arg: { key: K; value: SettingTypes[K]['value'] }): Promise<SettingTypes[K]['state']>;
  <C extends PlainChannel>(channel: C, ...args: ArgsOf<C>): Promise<ResultOf<C>>;
}

const invoke: Invoke = async (channel: InvokeChannel, arg?: unknown): Promise<never> => {
  const response: unknown = await window.electron.ipcRenderer.invoke(channel, arg as never);
  if (isIpcFailure(response)) {
    const { error } = response;
    throw error.name === 'INVALID_PAYLOAD'
      ? Object.assign(new Error(error.message), error)
      : Object.assign(new Error(), error, { message: `${error.message} Incident ${error.incidentId.slice(0, 8)}.` });
  }
  return response as never;
};

export const ipc = {
  invoke,
  send<C extends OneWayRendererToMainChannels>(channel: C, payload: OneWayRendererToMainChannelPayloads[C]): void {
    window.electron.ipcRenderer.sendMessage(channel, payload);
  },
  on<C extends OneWayMainToRendererChannels>(channel: C, listener: (payload: OneWayMainToRendererChannelPayloads[C]) => void): () => void {
    return window.electron.ipcRenderer.on(channel, listener);
  },
};

const MAX_ERROR_TEXT_LENGTH = 4000;

/** The stack of an error, which starts with its name and message, so the main process can group the failure by where it happened. */
function errorText(error: unknown): string {
  if (error instanceof Error) {
    return (error.stack?.includes(error.message) ? error.stack : withFrames(error)).slice(0, MAX_ERROR_TEXT_LENGTH);
  }
  return String(error).slice(0, MAX_ERROR_TEXT_LENGTH);
}

/** An error that got its message after it was built has a stack that starts without it, so the header is rebuilt in front of the frames. */
function withFrames(error: Error): string {
  const frames = error.stack?.split('\n').filter((line) => line.trimStart().startsWith('at ')) ?? [];
  return frames.length > 0 ? [`${error.name}: ${error.message}`, ...frames].join('\n') : error.message;
}

function write<E extends LogEventName>(level: LogLevel, event: E, data: LogEventMap[E], error?: unknown): void {
  ipc.send('log:write', {
    level,
    event,
    data,
    ...(error === undefined ? {} : { error: errorText(error) }),
  });
}

export const rendererLogger = {
  debug: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('debug', event, data, error),
  info: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('info', event, data, error),
  warn: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('warn', event, data, error),
  error: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('error', event, data, error),
};
