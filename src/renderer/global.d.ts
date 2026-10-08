import type { RendererApi } from '../shared/ipc';

declare global {
  interface Window {
    /** 由 preload 通过 contextBridge 注入 */
    arm: RendererApi;
  }
}
