import * as path from 'node:path';
import { detectAll } from './adapters';
import type { DetectedAgent } from './adapters/types';
import { mergeResources } from './dedupe';
import { exists, homeDir } from './fs-utils';
import { listProjects, scanProjectResources } from './projects';
import { scanMcpFromClaudeJson, scanMcpFromMcpJsonFile } from './scanners/mcp';
import { scanMemoryFile } from './scanners/memory';
import { scanPlugins } from './scanners/plugins';
import { scanSkillsDir } from './scanners/skills';
import type { Resource, ScanIssue, ScanResult, ScannedAgent } from './types';

export interface RunScanOptions {
  /** 覆盖用户主目录，测试用 */
  home?: string;
  /** 覆盖 adapter 列表，测试用 */
  adapters?: Parameters<typeof detectAll>[1];
}

/**
 * 全量扫描本机的 agent 资源。
 *
 * 流程：探测 agent → 按资源类型分别扫描 → 合并去重 → 汇总统计。
 * 任何单个环节的异常都被收成 ScanIssue，绝不让扫描整体失败——
 * 因为一台机器上总有若干坏文件，工具不能因为一个坏文件就用不了。
 */
export async function runScan(options: RunScanOptions = {}): Promise<ScanResult> {
  const startedAt = Date.now();
  const home = options.home ?? homeDir();

  const detected: DetectedAgent[] = await detectAll(home, options.adapters);

  const rawResources: Resource[] = [];
  const issues: ScanIssue[] = [];

  // ---- 逐 agent 扫描其用户级资源 ----
  for (const { adapter, paths } of detected) {
    const agentId = adapter.id;

    if (paths.skills) {
      const out = await scanSkillsDir(paths.skills, { agentId, scope: 'user' });
      rawResources.push(...out.resources);
      issues.push(...out.issues);
    }

    for (const mcpFile of paths.mcpFiles ?? []) {
      // ~/.claude.json 走专门的解析（顶层 + projects 两处）
      const isClaudeJson = path.basename(mcpFile).toLowerCase() === '.claude.json';
      const out = isClaudeJson
        ? await scanMcpFromClaudeJson(mcpFile, { agentId })
        : await scanMcpFromMcpJsonFile(mcpFile, { agentId, scope: 'user' });
      rawResources.push(...out.resources);
      issues.push(...out.issues);
    }

    // 用户级全局记忆文件（如 ~/.claude/CLAUDE.md）—— 对当前用户所有项目生效
    for (const memoryFile of paths.memoryFiles ?? []) {
      const out = await scanMemoryFile(memoryFile, { agentId, scope: 'user' });
      rawResources.push(...out.resources);
      issues.push(...out.issues);
    }

    if (paths.pluginsManifest && paths.pluginsMarketplaces && paths.pluginsCacheDir) {
      const out = await scanPlugins({
        manifestPath: paths.pluginsManifest,
        marketplacesPath: paths.pluginsMarketplaces,
        cacheDir: paths.pluginsCacheDir,
        agentId,
      });
      rawResources.push(...out.resources);
      issues.push(...out.issues);
    }
  }

  // ---- 项目级扫描：由 Claude 登记的项目清单驱动 ----
  const claudeJsonPath = path.join(home, '.claude.json');
  const hasClaudeJson = await exists(claudeJsonPath);
  if (hasClaudeJson) {
    for (const projectPath of await listProjects(claudeJsonPath)) {
      const out = await scanProjectResources(projectPath, {
        home,
        agentId: 'claude',
      });
      rawResources.push(...out.resources);
      issues.push(...out.issues);
    }
  }

  // ---- 合并去重 ----
  const resources = mergeResources(rawResources);

  // ---- 统计各 agent 能看到的资源数 ----
  const agents: ScannedAgent[] = detected.map(({ adapter, paths }) => ({
    id: adapter.id,
    name: adapter.name,
    paths,
    resourceCount: resources.filter((r) => r.usedBy.includes(adapter.id)).length,
  }));

  return {
    scannedAt: startedAt,
    durationMs: Date.now() - startedAt,
    agents,
    resources,
    issues,
  };
}
