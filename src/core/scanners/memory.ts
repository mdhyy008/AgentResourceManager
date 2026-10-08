import * as path from 'node:path';
import {
  listDir,
  normalizeKey,
  readTextOrNull,
  sha256,
  statOrNull,
} from '../fs-utils';
import type {
  AgentId,
  MemoryIndexEntry,
  MemoryResource,
  ResourceScope,
  ScanIssue,
} from '../types';

export interface ScanMemoryResult {
  resources: MemoryResource[];
  issues: ScanIssue[];
}

const INDEX_LINE =
  /^-\s*\[(?<title>[^\]]+)\]\((?<file>[^)]+)\)\s*[—–-]\s*(?<summary>.+)$/;

/**
 * Claude Code 把项目绝对路径换算成 projects/ 下的目录名：
 * 把 `:`、`/`、`\` 全部替换成 `-`。
 * 例如：D:/work/AgentResourceManager → D--work-AgentResourceManager
 *
 * 这个换算是不可逆的（路径里的 `-` 和分隔符无法区分），
 * 所以我们只做「正向计算 + 比对」，不去反推目录名对应的项目路径。
 */
export function projectSlug(projectPath: string): string {
  return projectPath.replace(/[:\\/]/g, '-');
}

export function parseMemoryIndex(text: string): MemoryIndexEntry[] {
  const entries: MemoryIndexEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = INDEX_LINE.exec(line.trim());
    if (!match?.groups) continue;
    entries.push({
      title: match.groups.title!.trim(),
      file: match.groups.file!.trim(),
      summary: match.groups.summary!.trim(),
    });
  }
  return entries;
}

function makeMemoryResource(params: {
  filePath: string;
  canonicalPath: string;
  name: string;
  kind: 'index' | 'note';
  body: string;
  agentId: AgentId;
  scope: ResourceScope;
  projectPath?: string;
  mtimeMs: number;
}): MemoryResource {
  const {
    filePath,
    canonicalPath,
    name,
    kind,
    body,
    agentId,
    scope,
    projectPath,
    mtimeMs,
  } = params;

  return {
    id: `memory:${normalizeKey(canonicalPath)}`,
    type: 'memory',
    name,
    description: kind === 'index' ? '记忆索引' : undefined,
    path: filePath,
    rawPaths: [filePath],
    usedBy: [agentId],
    scope,
    projectPath,
    mtimeMs,
    contentHash: sha256(body),
    kind,
    body,
    indexEntries: kind === 'index' ? parseMemoryIndex(body) : undefined,
  };
}

/**
 * 扫描某个项目的记忆目录：`~/.claude/projects/<slug>/memory/*.md`。
 *
 * 只扫 projectPath 换算出的那一个 slug 目录。这样避免了「反推 slug 对应哪个项目」
 * 这个不可能完成的任务，同时结果也精确。
 */
export async function scanMemoryDir(
  projectsRoot: string,
  options: { agentId: AgentId; projectPath: string },
): Promise<ScanMemoryResult> {
  const resources: MemoryResource[] = [];
  const issues: ScanIssue[] = [];
  const { agentId, projectPath } = options;

  const memoryDir = path.join(projectsRoot, projectSlug(projectPath), 'memory');

  for (const entry of await listDir(memoryDir)) {
    if (!entry.toLowerCase().endsWith('.md')) continue;

    const body = await readTextOrNull(entry);
    if (body === null) {
      issues.push({
        kind: 'unreadable',
        path: entry,
        agent: agentId,
        message: '记忆文件无法读取',
      });
      continue;
    }

    const name = path.basename(entry);
    const stat = await statOrNull(entry);

    resources.push(
      makeMemoryResource({
        filePath: entry,
        canonicalPath: entry,
        name,
        kind: name.toLowerCase() === 'memory.md' ? 'index' : 'note',
        body,
        agentId,
        scope: 'project',
        projectPath,
        mtimeMs: stat?.mtimeMs ?? 0,
      }),
    );
  }

  return { resources, issues };
}

/** 扫描单个记忆文件，如项目根的 CLAUDE.md / AGENTS.md */
export async function scanMemoryFile(
  filePath: string,
  options: { agentId: AgentId; scope: ResourceScope; projectPath?: string },
): Promise<ScanMemoryResult> {
  const resources: MemoryResource[] = [];
  const { agentId, scope, projectPath } = options;

  const body = await readTextOrNull(filePath);
  if (body === null) return { resources, issues: [] };

  const name = path.basename(filePath);
  const stat = await statOrNull(filePath);

  resources.push(
    makeMemoryResource({
      filePath,
      canonicalPath: filePath,
      name,
      kind: name.toLowerCase() === 'memory.md' ? 'index' : 'note',
      body,
      agentId,
      scope,
      projectPath,
      mtimeMs: stat?.mtimeMs ?? 0,
    }),
  );

  return { resources, issues: [] };
}
