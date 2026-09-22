import type { ElectronHandler } from '../../src/shared/channels';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

export {};
