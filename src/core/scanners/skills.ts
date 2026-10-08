import * as path from 'node:path';
import { FrontmatterError, parseFrontmatter } from '../frontmatter';
import {
  listDir,
  normalizeKey,
  readTextOrNull,
  realpathOrNull,
  sha256,
  statOrNull,
} from '../fs-utils';
import type { AgentId, ResourceScope, ScanIssue, SkillResource } from '../types';

export interface ScanSkillsOptions {
  agentId: AgentId;
  scope: ResourceScope;
  /** scope 为 project 时必填 */
  projectPath?: string;
  /** true 表示这些 skill 随插件安装，不可编辑 */
  readOnly?: boolean;
  pluginId?: string;
}

export interface ScanSkillsResult {
  resources: SkillResource[];
  issues: ScanIssue[];
}

/**
 * 扫描一个 skills 目录，每个子目录里应有一个 SKILL.md。
 * 符号链接会被解析到真实路径，这样同一个 skill 被多个 agent 引用时
 * 能生成相同的 id，交给 dedupe 合并。
 */
export async function scanSkillsDir(
  dir: string,
  options: ScanSkillsOptions,
): Promise<ScanSkillsResult> {
  const resources: SkillResource[] = [];
  const issues: ScanIssue[] = [];
  const { agentId, scope, projectPath, readOnly = false, pluginId } = options;

  for (const entry of await listDir(dir)) {
    const canonical = await realpathOrNull(entry);
    if (canonical === null) {
      issues.push({
        kind: 'broken-symlink',
        path: entry,
        agent: agentId,
        message: '符号链接指向的目标不存在',
      });
      continue;
    }

    const canonicalStat = await statOrNull(canonical);
    if (!canonicalStat?.isDirectory()) continue;

    const manifestPath = path.join(canonical, 'SKILL.md');
    const text = await readTextOrNull(manifestPath);
    if (text === null) {
      const stat = await statOrNull(manifestPath);
      issues.push({
        kind: stat === null ? 'missing-manifest' : 'permission',
        path: manifestPath,
        agent: agentId,
        message: stat === null ? '目录内没有 SKILL.md' : 'SKILL.md 无法读取',
      });
      continue;
    }

    let parsed;
    try {
      parsed = parseFrontmatter(text);
    } catch (err) {
      issues.push({
        kind: 'bad-frontmatter',
        path: manifestPath,
        agent: agentId,
        message:
          err instanceof FrontmatterError ? err.message : (err as Error).message,
      });
      continue;
    }

    const name =
      typeof parsed.data.name === 'string' && parsed.data.name.trim() !== ''
        ? parsed.data.name
        : path.basename(canonical);
    const description =
      typeof parsed.data.description === 'string'
        ? parsed.data.description
        : undefined;
    const manifestStat = await statOrNull(manifestPath);

    resources.push({
      id: `skill:${normalizeKey(canonical)}`,
      type: 'skill',
      name,
      description,
      path: canonical,
      rawPaths: [entry],
      usedBy: [agentId],
      scope,
      projectPath,
      mtimeMs: manifestStat?.mtimeMs ?? 0,
      contentHash: sha256(text),
      readOnly,
      pluginId,
      frontmatter: parsed.data,
      body: parsed.body,
    });
  }

  return { resources, issues };
}
