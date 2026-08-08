type UtilsChannels = 'utils:get-node-version';
type RssChannels = 'feeds:result';

// Channels invoked by the renderer via ipcRenderer.invoke, requiring an ipcMain.handle.
export type InvokeChannels = UtilsChannels;

export type Channels =
  | UtilsChannels
  | RssChannels;
