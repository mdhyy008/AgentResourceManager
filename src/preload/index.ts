import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppConfig, ExportRequest, RendererApi, WriteRequest } from '../shared/ipc';

/**
 * 渲染进程唯一能碰到主进程的入口。只暴露这几个用途明确的方法，
 * 不把 ipcRenderer 整个交出去，避免渲染层任意发通道。
 */
const api: RendererApi = {
  getCachedScan: () => ipcRenderer.invoke(IPC.scanCached),
  runScan: () => ipcRenderer.invoke(IPC.scanRun),
  getConfig: () => ipcRenderer.invoke(IPC.configGet),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke(IPC.configSave, config),
  pickDirectory: () => ipcRenderer.invoke(IPC.dialogPickDirectory),
  revealPath: (target: string) => ipcRenderer.invoke(IPC.shellReveal, target),
  previewWrite: (request: WriteRequest) => ipcRenderer.invoke(IPC.writePreview, request),
  applyWrite: (request: WriteRequest) => ipcRenderer.invoke(IPC.writeApply, request),
  listOperations: () => ipcRenderer.invoke(IPC.opsList),
  undoOperation: (id: string) => ipcRenderer.invoke(IPC.opsUndo, id),
  exportPackage: (request: ExportRequest) => ipcRenderer.invoke(IPC.exportPackage, request),
};

contextBridge.exposeInMainWorld('arm', api);
