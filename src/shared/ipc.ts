import type { ResourceType, ScanResult } from '../core/types';

/** 渲染进程 ↔ 主进程之间的通道名，集中定义避免两边写错字符串 */
export const IPC = {
  scanCached: 'scan:cached',
  scanRun: 'scan:run',
  configGet: 'config:get',
  configSave: 'config:save',
  dialogPickDirectory: 'dialog:pickDirectory',
  shellReveal: 'shell:reveal',
  writePreview: 'write:preview',
  writeApply: 'write:apply',
  opsList: 'ops:list',
  opsUndo: 'ops:undo',
  exportPackage: 'export:package',
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

export type WriteKind =
  | 'skill-enabled'
  | 'skill-frontmatter'
  | 'skill-share'
  | 'memory-body'
  | 'mcp-add'
  | 'mcp-remove';

/** 写入前对目标文件状态的预期，用来发现「扫描之后被外部改过」 */
export interface FileExpect {
  mtimeMs: number;
  contentHash: string;
}

export type WriteRequest =
  | { kind: 'skill-enabled'; skillDir: string; expect: FileExpect; enabled: boolean }
  | {
      kind: 'skill-frontmatter';
      skillDir: string;
      expect: FileExpect;
      frontmatter: Record<string, unknown>;
    }
  | {
      kind: 'skill-share';
      /** 源 skill 的目录（canonical 路径） */
      sourceDir: string;
      /** 目标 agent 的 skills 目录；名字取 sourceDir 的目录名 */
      targetSkillsDir: string;
      /** link = 目录联接（junction），copy = 整目录复制 */
      mode: 'link' | 'copy';
    }
  | { kind: 'memory-body'; filePath: string; expect: FileExpect; body: string }
  | {
      kind: 'mcp-add';
      configPath: string;
      configPointer: string[];
      serverName: string;
      /** null 表示该 mcpServers 配置尚不存在，本次是「从零新建」 */
      expect: FileExpect | null;
      entry: Record<string, unknown>;
    }
  | {
      kind: 'mcp-remove';
      configPath: string;
      configPointer: string[];
      serverName: string;
      expect: FileExpect;
    };

/** dry-run 结果：给界面展示即将发生的改动 */
export interface WritePreview {
  ok: true;
  targetPath: string;
  summary: string;
  /** before/after 是文件全文、某个子树，还是「文件系统结构改动」的文字描述 */
  scope: 'file' | 'subtree' | 'fs';
  before: string;
  after: string;
}

export interface WriteFailure {
  ok: false;
  /** true 表示目标文件在扫描之后被外部改动过 */
  conflict: boolean;
  message: string;
}

export type WritePreviewResult = WritePreview | WriteFailure;

export interface WriteApplyResult {
  ok: boolean;
  message: string;
  operationId?: string;
}

export interface OperationRecord {
  id: string;
  at: number;
  kind: WriteKind;
  summary: string;
  targetPath: string;
  /** 写之前原文件的副本路径；null 表示写之前文件不存在 */
  backupPath: string | null;
  undone: boolean;
  undoneAt?: number;
}

export interface UndoResult {
  ok: boolean;
  message: string;
}

export interface RevealResult {
  ok: boolean;
  message?: string;
}

/**
 * 导出请求。带上渲染进程当前展示的扫描结果，导出的就是用户眼前这一份，
 * 而不是主进程缓存里可能已经过期的版本。
 */
export interface ExportRequest {
  types: ResourceType[];
  result: ScanResult;
}

export interface ExportResult {
  ok: boolean;
  /** 用户在保存对话框里点了取消 */
  canceled?: boolean;
  /** 成功写出的 zip 路径 */
  path?: string;
  /** 各类资源实际打包的条目数 */
  counts?: Record<string, number>;
  /** 打包过程中产生的提醒（如明文密钥） */
  warnings?: string[];
  message?: string;
}

/** preload 通过 contextBridge 暴露给渲染进程的 API 形状 */
export interface RendererApi {
  getCachedScan(): Promise<ScanState>;
  runScan(): Promise<ScanState>;
  getConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<AppConfig>;
  pickDirectory(): Promise<string | null>;
  revealPath(path: string): Promise<RevealResult>;
  previewWrite(request: WriteRequest): Promise<WritePreviewResult>;
  applyWrite(request: WriteRequest): Promise<WriteApplyResult>;
  listOperations(): Promise<OperationRecord[]>;
  undoOperation(operationId: string): Promise<UndoResult>;
  exportPackage(request: ExportRequest): Promise<ExportResult>;
}
