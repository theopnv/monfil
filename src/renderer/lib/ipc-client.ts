import type {
  OneWayMainToRendererChannelPayloads,
  OneWayMainToRendererChannels,
  OneWayRendererToMainChannelPayloads,
  OneWayRendererToMainChannels,
  TwoWayRendererMainChannelPayloads,
  TwoWayRendererMainChannels,
  TwoWayRendererMainChannelsInvokeArgs,
} from '../../shared/channels';
import type { LogEventMap, LogEventName, LogLevel } from '../../shared/logging';

export const ipc = {
  async invoke<C extends TwoWayRendererMainChannels>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C]): Promise<TwoWayRendererMainChannelPayloads[C]> {
    const response: unknown = await window.electron.ipcRenderer.invoke(channel, arg);
    if (response && typeof response === 'object' && 'success' in response && response.success === false && 'error' in response) {
      const failure = response as { error: { name?: string; message?: string; incidentId?: string } };
      if (failure.error.name === 'UNEXPECTED_ERROR' && failure.error.message && failure.error.incidentId) {
        throw Object.assign(new Error(`${failure.error.message} Incident ${failure.error.incidentId.slice(0, 8)}.`), failure.error);
      }
    }
    return response as TwoWayRendererMainChannelPayloads[C];
  },
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
