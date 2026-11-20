// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { OneWayMainToRendererChannelPayloads, OneWayMainToRendererChannels, OneWayRendererToMainChannelPayloads, OneWayRendererToMainChannels } from './channels';
import type { LanguageCode } from './i18n/languages';
import type { ArgOf, InvokeChannel, IpcInvokeResponse } from './ipc-schema';

export interface ElectronHandler {
  /** The operating system locale, read at startup. Absent when the window did not get one. */
  systemLocale?: string;
  /** The interface language that main resolved when it made the window. Absent when the window did not get one. */
  language?: LanguageCode;
  /** Whether the first-run hints may show. Main decides, and the window gets the answer at startup. */
  hintsEnabled?: boolean;
  ipcRenderer: {
    sendMessage<C extends OneWayRendererToMainChannels>(channel: C, payload: OneWayRendererToMainChannelPayloads[C]): void;
    on<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void): () => void;
    invoke<C extends InvokeChannel>(channel: C, arg: ArgOf<C>): Promise<IpcInvokeResponse<C>>;
  };
}
