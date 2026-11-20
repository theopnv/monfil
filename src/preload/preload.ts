// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { contextBridge, ipcRenderer } from "electron/renderer";
import type { IpcRendererEvent } from "electron";
import type {
  ElectronHandler,
  OneWayMainToRendererChannelPayloads,
  OneWayMainToRendererChannels,
  OneWayRendererToMainChannelPayloads,
  OneWayRendererToMainChannels,
  IpcInvokeResponse,
  TwoWayRendererMainChannels,
  TwoWayRendererMainChannelsInvokeArgs,
} from "../shared/channels";
import { HINTS_ARGUMENT } from "../shared/contracts";
import { SYSTEM_LOCALE_ARGUMENT } from "../shared/i18n/format-locale";
import { isLanguageCode, LANGUAGE_ARGUMENT } from "../shared/i18n/languages";

const systemLocale = process.argv.find((argument) => argument.startsWith(SYSTEM_LOCALE_ARGUMENT))?.slice(SYSTEM_LOCALE_ARGUMENT.length);

const argumentLanguage = process.argv.find((argument) => argument.startsWith(LANGUAGE_ARGUMENT))?.slice(LANGUAGE_ARGUMENT.length);
const language = isLanguageCode(argumentLanguage) ? argumentLanguage : undefined;

const hintsArgument = process.argv.find((argument) => argument.startsWith(HINTS_ARGUMENT))?.slice(HINTS_ARGUMENT.length);

const electronHandler: ElectronHandler = {
  ...(systemLocale ? { systemLocale } : {}),
  ...(language ? { language } : {}),
  ...(hintsArgument ? { hintsEnabled: hintsArgument === 'true' } : {}),
  ipcRenderer: {
    sendMessage<C extends OneWayRendererToMainChannels>(channel: C, payload: OneWayRendererToMainChannelPayloads[C]) {
      ipcRenderer.send(channel, payload);
    },
    on<C extends OneWayMainToRendererChannels>(channel: C, func: (payload: OneWayMainToRendererChannelPayloads[C]) => void) {
      const subscription = (_event: IpcRendererEvent, payload: OneWayMainToRendererChannelPayloads[C]) =>
        func(payload);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    invoke<C extends TwoWayRendererMainChannels>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C]): Promise<IpcInvokeResponse<C>> {
      return ipcRenderer.invoke(channel, arg);
    }
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);
