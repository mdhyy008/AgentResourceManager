import {
  displayPath,
  normalizeKey,
  readJsonOrNull,
  sha256,
  statOrNull,
} from '../fs-utils';
import type {
  AgentId,
  McpResource,
  McpServerEntry,
  ResourceScope,
  ScanIssue,
} from '../types';

export interface ScanMcpResult {
  resources: McpResource[];
  issues: ScanIssue[];
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === 'string',
  );
}

/**
 * 把任意形状的 MCP server 配置归一成 McpServerEntry。
 * 同时保留 `raw`，因为计划 3 的写入层需要无损回写未被识别的字段。
 */
export function normalizeMcpServer(name: string, raw: unknown): McpServerEntry {
  const obj =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const command = typeof obj.command === 'string' ? obj.command : undefined;
  const url = typeof obj.url === 'string' ? obj.url : undefined;
  const args = Array.isArray(obj.args)
    ? obj.args.filter((a): a is string => typeof a === 'string')
    : undefined;
  const env = isStringMap(obj.env) ? obj.env : undefined;
  const headers = isStringMap(obj.headers) ? obj.headers : undefined;

  let transport: McpServerEntry['transport'] = 'unknown';
  if (obj.type === 'sse') transport = 'sse';
  else if (obj.type === 'http') transport = 'http';
  else if (command !== undefined) transport = 'stdio';
  else if (url !== undefined) transport = 'http';

  return { name, transport, command, args, url, env, headers, raw };
}

function serversFrom(value: unknown): McpServerEntry[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([name, cfg]) =>
    normalizeMcpServer(name, cfg),
  );
}

function makeMcpResource(params: {
  configPath: string;
  configPointer: string[];
  servers: McpServerEntry[];
  agentId: AgentId;
  scope: ResourceScope;
  projectPath?: string;
  fileText: string;
  mtimeMs: number;
}): McpResource {
  const {
    configPath,
    configPointer,
    servers,
    agentId,
    scope,
    projectPath,
    fileText,
    mtimeMs,
  } = params;

  const idKey = `${displayPath(configPath)}#${configPointer.join('.')}`;
  const label = configPointer.length > 1 ? `${projectPath ?? ''}`.trim() : '';

  return {
    id: `mcp:${normalizeKey(idKey)}`,
    type: 'mcp',
    name: label ? `MCP · ${label}` : 'MCP · 用户级',
    description: `${servers.length} 个 server`,
    path: configPath,
    rawPaths: [configPath],
    usedBy: [agentId],
    scope,
    projectPath,
    mtimeMs,
    contentHash: sha256(fileText),
    servers,
    configPath,
    configPointer,
  };
}

/**
 * 扫 ~/.claude.json：顶层 `mcpServers` 是用户级，`projects.<abs>.mcpServers` 是项目级。
 * 注意本机顶层没有这个键、项目的都是空数组，所以返回空是正确行为。
 */
export async function scanMcpFromClaudeJson(
  filePath: string,
  options: { agentId: AgentId },
): Promise<ScanMcpResult> {
  const resources: McpResource[] = [];
  const issues: ScanIssue[] = [];
  const { agentId } = options;

  const read = await readJsonOrNull(filePath);
  if (read === null) return { resources, issues };

  if (!read.ok) {
    issues.push({
      kind: 'bad-json',
      path: filePath,
      agent: agentId,
      message: `JSON 解析失败：${read.error}`,
    });
    return { resources, issues };
  }

  const root =
    read.value !== null && typeof read.value === 'object' && !Array.isArray(read.value)
      ? (read.value as Record<string, unknown>)
      : {};

  const stat = await statOrNull(filePath);
  const mtimeMs = stat?.mtimeMs ?? 0;

  const topLevel = serversFrom(root.mcpServers);
  if (topLevel.length > 0) {
    resources.push(
      makeMcpResource({
        configPath: filePath,
        configPointer: ['mcpServers'],
        servers: topLevel,
        agentId,
        scope: 'user',
        fileText: JSON.stringify(root.mcpServers),
        mtimeMs,
      }),
    );
  }

  const projects = root.projects;
  if (projects !== null && typeof projects === 'object' && !Array.isArray(projects)) {
    for (const [projectPath, entry] of Object.entries(
      projects as Record<string, unknown>,
    )) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const servers = serversFrom((entry as Record<string, unknown>).mcpServers);
      if (servers.length === 0) continue;
      resources.push(
        makeMcpResource({
          configPath: filePath,
          configPointer: ['projects', projectPath, 'mcpServers'],
          servers,
          agentId,
          scope: 'project',
          projectPath,
          fileText: JSON.stringify(servers),
          mtimeMs,
        }),
      );
    }
  }

  return { resources, issues };
}

/**
 * 扫形如 `<project>/.mcp.json` 或 `~/.cursor/mcp.json` 的单文件配置。
 * 这类文件的顶层就是一个 `mcpServers` 对象。
 */
export async function scanMcpFromMcpJsonFile(
  filePath: string,
  options: { agentId: AgentId; scope: ResourceScope; projectPath?: string },
): Promise<ScanMcpResult> {
  const resources: McpResource[] = [];
  const issues: ScanIssue[] = [];
  const { agentId, scope, projectPath } = options;

  const read = await readJsonOrNull(filePath);
  if (read === null) return { resources, issues };

  if (!read.ok) {
    issues.push({
      kind: 'bad-json',
      path: filePath,
      agent: agentId,
      message: `JSON 解析失败：${read.error}`,
    });
    return { resources, issues };
  }

  const root =
    read.value !== null && typeof read.value === 'object' && !Array.isArray(read.value)
      ? (read.value as Record<string, unknown>)
      : {};

  const servers = serversFrom(root.mcpServers);
  if (servers.length === 0) return { resources, issues };

  const stat = await statOrNull(filePath);
  resources.push(
    makeMcpResource({
      configPath: filePath,
      configPointer: ['mcpServers'],
      servers,
      agentId,
      scope,
      projectPath,
      fileText: JSON.stringify(root.mcpServers),
      mtimeMs: stat?.mtimeMs ?? 0,
    }),
  );

  return { resources, issues };
}
