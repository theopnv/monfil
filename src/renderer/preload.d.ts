import type { ElectronHandler } from '../shared/channels';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

export { };
