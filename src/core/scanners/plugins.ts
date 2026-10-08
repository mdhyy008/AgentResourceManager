import * as path from 'node:path';
import { normalizeKey, readJsonOrNull, sha256, statOrNull } from '../fs-utils';
import { scanSkillsDir } from './skills';
import type { AgentId, PluginResource, Resource, ScanIssue } from '../types';

export interface ScanPluginsOptions {
  manifestPath: string;
  marketplacesPath: string;
  cacheDir: string;
  agentId: AgentId;
  /**
   * 覆盖安装路径的解析。测试用它可以指向夹具目录，
   * 生产环境不传即使用 manifest 里记录的 installPath。
   */
  resolveInstallPath?: (installPath: string) => string;
}

export interface ScanPluginsResult {
  resources: Resource[];
  issues: ScanIssue[];
}

interface InstalledPluginEntry {
  scope?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
  gitCommitSha?: string;
}

interface MarketplaceEntry {
  source?: { source?: string; repo?: string };
  installLocation?: string;
  lastUpdated?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * 扫 Claude Code 的插件清单。
 *
 * 插件自带的 skill 位于安装目录下的 `skills/<skill 名>/SKILL.md`，会被标记
 * readOnly: true，因为插件升级时整个安装目录会被替换，用户对其中文件的修改会丢失。
 */
export async function scanPlugins(
  options: ScanPluginsOptions,
): Promise<ScanPluginsResult> {
  const {
    manifestPath,
    marketplacesPath,
    cacheDir,
    agentId,
    resolveInstallPath = (p) => p,
  } = options;

  const resources: Resource[] = [];
  const issues: ScanIssue[] = [];

  const manifestRead = await readJsonOrNull(manifestPath);
  if (manifestRead === null) return { resources, issues };
  if (!manifestRead.ok) {
    issues.push({
      kind: 'bad-json',
      path: manifestPath,
      agent: agentId,
      message: `插件清单解析失败：${manifestRead.error}`,
    });
    return { resources, issues };
  }

  const marketplacesRead = await readJsonOrNull(marketplacesPath);
  const marketplaces =
    marketplacesRead && marketplacesRead.ok
      ? (asRecord(marketplacesRead.value) ?? {})
      : {};

  const manifestRoot = asRecord(manifestRead.value);
  const pluginsObj = manifestRoot ? asRecord(manifestRoot.plugins) : null;
  if (!pluginsObj) return { resources, issues };

  const manifestStat = await statOrNull(manifestPath);
  const manifestMtime = manifestStat?.mtimeMs ?? 0;

  for (const [pluginId, entriesRaw] of Object.entries(pluginsObj)) {
    const entries = Array.isArray(entriesRaw) ? entriesRaw : [entriesRaw];

    for (const entryRaw of entries) {
      const entry = asRecord(entryRaw) as InstalledPluginEntry | null;
      if (!entry?.installPath) continue;

      const [pluginName, marketplaceFromId] = splitPluginId(pluginId);
      const marketplace = marketplaceFromId ?? 'unknown';
      const installPath = resolveInstallPath(entry.installPath);
      const scope: PluginResource['scope'] =
        entry.scope === 'project' ? 'project' : 'user';

      // 若有官方 marketplace 记录，以其 repo 作为描述补充
      const marketplaceInfo = asRecord(
        marketplaces[marketplace],
      ) as MarketplaceEntry | null;
      const repo = marketplaceInfo?.source?.repo;

      const pluginResource: PluginResource = {
        id: `plugin:${normalizeKey(installPath)}#${pluginId}`,
        type: 'plugin',
        name: pluginName,
        description: repo ? `来自 ${repo} 的插件` : `来自 ${marketplace} 的插件`,
        path: installPath,
        rawPaths: [installPath],
        usedBy: [agentId],
        scope,
        mtimeMs: manifestMtime,
        contentHash: sha256(
          `${pluginId}@${entry.version ?? ''}#${entry.gitCommitSha ?? ''}`,
        ),
        pluginId,
        version: entry.version ?? 'unknown',
        marketplace,
        gitCommitSha: entry.gitCommitSha,
        installPath,
      };
      resources.push(pluginResource);

      const { resources: skills, issues: skillIssues } = await scanSkillsDir(
        path.join(installPath, 'skills'),
        { agentId, scope, readOnly: true, pluginId },
      );
      resources.push(...skills);
      issues.push(...skillIssues);
    }
  }

  // cacheDir 目前只用于将来定位插件缓存，先保留参数以免接口变动
  void cacheDir;

  return { resources, issues };
}

function splitPluginId(pluginId: string): [string, string | undefined] {
  const at = pluginId.indexOf('@');
  if (at === -1) return [pluginId, undefined];
  return [pluginId.slice(0, at), pluginId.slice(at + 1)];
}
