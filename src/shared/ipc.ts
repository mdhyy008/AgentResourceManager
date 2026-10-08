import type { ScanResult } from '../core/types';

/** 渲染进程 ↔ 主进程之间的通道名，集中定义避免两边写错字符串 */
export const IPC = {
  scanCached: 'scan:cached',
  scanRun: 'scan:run',
  configGet: 'config:get',
  configSave: 'config:save',
  dialogPickDirectory: 'dialog:pickDirectory',
} as const;

/**
 * 用户自定义的 agent。内置 adapter 之外的 agent 由用户手工登记：
 * 一个根目录 + 各资源相对根目录的位置。
 */
export interface CustomAgentConfig {
  /** 唯一 id，不能与内置 agent 冲突 */
  id: string;
  /** 展示名 */
  name: string;
  /** 根目录的绝对路径 */
  root: string;
  /** skills 目录相对 root 的位置，留空表示该 agent 没有 skills */
  skillsSubdir?: string;
  /** MCP 配置文件相对 root 的位置，可多个 */
  mcpFiles?: string[];
}

export interface AppConfig {
  customAgents: CustomAgentConfig[];
}

export interface ScanState {
  status: 'idle' | 'scanning' | 'done' | 'error';
  result: ScanResult | null;
  /** status 为 error 时的原因 */
  error?: string;
  /** 本次结果是来自磁盘缓存还是刚跑完的扫描 */
  fromCache: boolean;
}

/** preload 通过 contextBridge 暴露给渲染进程的 API 形状 */
export interface RendererApi {
  getCachedScan(): Promise<ScanState>;
  runScan(): Promise<ScanState>;
  getConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<AppConfig>;
  pickDirectory(): Promise<string | null>;
}
