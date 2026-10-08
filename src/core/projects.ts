import * as path from 'node:path';
import { exists, readJsonOrNull } from './fs-utils';
import { scanMcpFromMcpJsonFile } from './scanners/mcp';
import { scanMemoryDir, scanMemoryFile } from './scanners/memory';
import { scanSkillsDir } from './scanners/skills';
import type { AgentId, Resource, ScanIssue } from './types';

/**
 * 读出 ~/.claude.json 里登记过的项目绝对路径。
 *
 * 这些路径是 Claude Code 自己的记录（key 就是原始绝对路径），
 * 我们用它们来决定「项目级扫描扫哪些目录」——比满盘搜索可靠得多。
 */
export async function listProjects(claudeJsonPath: string): Promise<string[]> {
  const read = await readJsonOrNull(claudeJsonPath);
  if (!read || !read.ok) return [];

  const root =
    read.value !== null && typeof read.value === 'object' && !Array.isArray(read.value)
      ? (read.value as Record<string, unknown>)
      : {};

  const projects = root.projects;
  if (projects === null || typeof projects !== 'object' || Array.isArray(projects)) {
    return [];
  }

  return Object.keys(projects as Record<string, unknown>);
}

export interface ScanProjectOptions {
  /** 用户主目录，用于定位 ~/.claude/projects/<slug>/memory */
  home: string;
  agentId: AgentId;
}

export interface ScanProjectResult {
  resources: Resource[];
  issues: ScanIssue[];
}

/** 项目根下我们关心的文件名 */
const PROJECT_MEMORY_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  'GEMINI.md',
  '.cursorrules',
];

/**
 * 扫描单个项目的项目级资源：
 *  - `<project>/.claude/skills/<skill 名>/SKILL.md` → skill（项目级）
 *  - `<project>/.mcp.json`                          → mcp（项目级）
 *  - `<project>/{CLAUDE,AGENTS,GEMINI}.md` 等        → memory（项目级）
 *  - `~/.claude/projects/<slug>/memory/<文件>.md`    → memory（项目级，per-project 记忆）
 */
export async function scanProjectResources(
  projectPath: string,
  options: ScanProjectOptions,
): Promise<ScanProjectResult> {
  const { home, agentId } = options;
  const resources: Resource[] = [];
  const issues: ScanIssue[] = [];

  if (!(await exists(projectPath))) {
    return { resources, issues };
  }

  const skills = await scanSkillsDir(path.join(projectPath, '.claude', 'skills'), {
    agentId,
    scope: 'project',
    projectPath,
  });
  resources.push(...skills.resources);
  issues.push(...skills.issues);

  const mcp = await scanMcpFromMcpJsonFile(path.join(projectPath, '.mcp.json'), {
    agentId,
    scope: 'project',
    projectPath,
  });
  resources.push(...mcp.resources);
  issues.push(...mcp.issues);

  for (const fileName of PROJECT_MEMORY_FILES) {
    const memory = await scanMemoryFile(path.join(projectPath, fileName), {
      agentId,
      scope: 'project',
      projectPath,
    });
    resources.push(...memory.resources);
  }

  const projectMemory = await scanMemoryDir(
    path.join(home, '.claude', 'projects'),
    { agentId, projectPath },
  );
  resources.push(...projectMemory.resources);
  issues.push(...projectMemory.issues);

  return { resources, issues };
}
