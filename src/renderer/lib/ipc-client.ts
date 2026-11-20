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

interface Invoke {
  <K extends SettingKey>(channel: 'settings:get', arg: { key: K }): Promise<SettingTypes[K]['state']>;
  <K extends SettingKey>(channel: 'settings:set', arg: { key: K; value: SettingTypes[K]['value'] }): Promise<SettingTypes[K]['state']>;
  <C extends PlainChannel>(channel: C, arg: ArgOf<C>): Promise<ResultOf<C>>;
}

const invoke: Invoke = async (channel: InvokeChannel, arg: unknown): Promise<never> => {
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

function write<E extends LogEventName>(level: LogLevel, event: E, data: LogEventMap[E], error?: unknown): void {
  ipc.send('log:write', {
    level,
    event,
    data,
    ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error) }),
  });
}

export const rendererLogger = {
  debug: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('debug', event, data, error),
  info: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('info', event, data, error),
  warn: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('warn', event, data, error),
  error: <E extends LogEventName>(event: E, data: LogEventMap[E], error?: unknown) => write('error', event, data, error),
};
