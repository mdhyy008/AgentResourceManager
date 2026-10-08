/** 四类可被管理的资源 */
export type ResourceType = 'skill' | 'mcp' | 'memory' | 'plugin';

/** 内置 agent 的 id；自定义 adapter 可以是任意字符串 */
export type AgentId =
  | 'claude'
  | 'cursor'
  | 'lingma'
  | 'agents'
  | 'codex'
  | 'gemini'
  | 'windsurf'
  | 'trae'
  | 'continue'
  | (string & {});

/** 资源是用户级还是某个项目级 */
export type ResourceScope = 'user' | 'project';

export interface BaseResource {
  /** 稳定唯一 id，格式 `${type}:${canonicalPath 小写}` */
  id: string;
  type: ResourceType;
  name: string;
  description?: string;
  /** 真实落盘路径（已 resolve symlink） */
  path: string;
  /** 所有指向它的原始路径（含符号链接路径），用于展示「被哪些 agent 引用」 */
  rawPaths: string[];
  /** 能看到这个资源的 agent（去重后） */
  usedBy: AgentId[];
  scope: ResourceScope;
  /** scope 为 project 时，该项所属项目的绝对路径 */
  projectPath?: string;
  mtimeMs: number;
  contentHash: string;
}

export interface SkillResource extends BaseResource {
  type: 'skill';
  /** 解析出的 frontmatter 键值对 */
  frontmatter: Record<string, unknown>;
  /** frontmatter 之后的正文原文 */
  body: string;
  /** true 表示随插件安装，不可编辑（插件升级会覆盖） */
  readOnly: boolean;
  /** readOnly 为 true 时，来源插件的 id，如 "superpowers@superpowers-marketplace" */
  pluginId?: string;
}

export interface McpServerEntry {
  name: string;
  transport: 'stdio' | 'http' | 'sse' | 'unknown';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  /** 原始 JSON，交给计划 3 的写入层做无损回写 */
  raw: unknown;
}

export interface McpResource extends BaseResource {
  type: 'mcp';
  servers: McpServerEntry[];
  /** 写入目标文件路径（计划 3 用） */
  configPath: string;
  /** 该文件里 mcpServers 所在的 JSON 指针，如 ["mcpServers"] 或 ["projects","D:/x","mcpServers"] */
  configPointer: string[];
}

export interface MemoryIndexEntry {
  title: string;
  file: string;
  summary: string;
}

export interface MemoryResource extends BaseResource {
  type: 'memory';
  kind: 'index' | 'note';
  body: string;
  /** 仅 kind === 'index'（即 MEMORY.md）时有值 */
  indexEntries?: MemoryIndexEntry[];
}

export interface PluginResource extends BaseResource {
  type: 'plugin';
  pluginId: string;
  version: string;
  marketplace: string;
  gitCommitSha?: string;
  installPath: string;
}

export type Resource =
  | SkillResource
  | McpResource
  | MemoryResource
  | PluginResource;

export type ScanIssueKind =
  | 'broken-symlink'
  | 'unreadable'
  | 'permission'
  | 'bad-frontmatter'
  | 'bad-json'
  | 'missing-manifest'
  | 'unknown';

export interface ScanIssue {
  kind: ScanIssueKind;
  /** 出问题的路径 */
  path: string;
  /** 由哪个 agent 的扫描产生（若与 agent 无关则为 undefined） */
  agent?: AgentId;
  message: string;
}

export interface ScannedAgent {
  id: AgentId;
  name: string;
  /** 探测到的各类资源根路径 */
  paths: AdapterPaths;
}

export interface ScanResult {
  scannedAt: number;
  durationMs: number;
  agents: ScannedAgent[];
  resources: Resource[];
  issues: ScanIssue[];
}

/** adapter 探测出的路径集合（在 adapters/types.ts 里被 adapter 实现引用） */
export interface AdapterPaths {
  skills?: string;
  mcpFiles?: string[];
  /** 记忆文件所在目录（递归找 *.md） */
  memoryDirs?: string[];
  /** 记忆文件的显式文件列表（如项目根的 CLAUDE.md） */
  memoryFiles?: string[];
  pluginsManifest?: string;
  pluginsMarketplaces?: string;
  pluginsCacheDir?: string;
}
