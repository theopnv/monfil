// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { incrementCounter } from '../analytics/counters';
import { ipcSchema, type ArgOf, type InvokeChannel, type IpcInvokeResponse, type ResultOf, type Rpc } from '../../shared/ipc-schema';
import { ipcFailure } from '../../shared/result';
import { createIncidentId } from '../logging/incident';
import { logger } from '../logging/logger';
import { routes, type Route } from './routes';

// Renderer to main, two ways: ipcRenderer.invoke(channel, arg) on the renderer side, ipcMain.handle(channel, listener) here.
// https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-2-renderer-to-main-two-way

function isFailure(response: unknown): boolean {
  return typeof response === 'object' && response !== null && 'success' in response && response.success === false;
}

function failedSetting(channel: string, arg: unknown): string | undefined {
  return channel.startsWith('settings:') && typeof arg === 'object' && arg !== null && 'key' in arg && typeof arg.key === 'string' ? arg.key : undefined;
}

async function dispatch<C extends InvokeChannel>(channel: C, event: IpcMainInvokeEvent, arg: unknown): Promise<IpcInvokeResponse<C>> {
  try {
    if (!(ipcSchema[channel] as Rpc<ArgOf<C>, ResultOf<C>>).guard(arg)) {
      return ipcFailure('INVALID_PAYLOAD');
    }
    const route = routes[channel] as unknown as Route<C>;
    const response = await route.run(arg, event);
    const counter = typeof route.counter === 'function' ? route.counter(arg) : route.counter;
    // A failed Result counts for nothing.
    if (counter && !isFailure(response)) {
      void incrementCounter(counter);
    }
    return response;
  } catch (error) {
    const incidentId = createIncidentId();
    const setting = failedSetting(channel, arg);
    logger.error('ipc.failure', { channel, incidentId, ...(setting ? { setting } : {}) }, error);
    return ipcFailure('UNEXPECTED_ERROR', incidentId);
  }
}

export function registerIpcHandlers() {
  for (const channel of Object.keys(routes) as InvokeChannel[]) {
    ipcMain.handle(channel, (event, arg: unknown) => dispatch(channel, event, arg));
  }
}
