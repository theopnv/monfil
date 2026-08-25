import { ElectronHandler } from '../preload/preload';

declare global {
  interface Window {
    electron: ElectronHandler;
  }
}

export { };
