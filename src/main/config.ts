import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readJsonOrNull } from '../core/fs-utils';
import type { AppConfig, CustomAgentConfig } from '../shared/ipc';

/** 与扫描缓存共用一个数据目录 */
export function configPath(dataDir: string): string {
  return path.join(dataDir, 'config.json');
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * 配置来自渲染进程，属于外部输入，落盘前逐字段校验，
 * 免得一个手改坏的 config.json 让整个扫描起不来。
 */
function isCustomAgent(v: unknown): v is CustomAgentConfig {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Partial<CustomAgentConfig>;
  if (!isNonEmptyString(c.id) || !isNonEmptyString(c.name) || !isNonEmptyString(c.root)) {
    return false;
  }
  if (c.skillsSubdir !== undefined && typeof c.skillsSubdir !== 'string') return false;
  if (c.mcpFiles !== undefined) {
    if (!Array.isArray(c.mcpFiles)) return false;
    if (!c.mcpFiles.every((f) => typeof f === 'string')) return false;
  }
  return true;
}

export function sanitizeConfig(value: unknown): AppConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { customAgents: [] };
  }
  const agents = (value as { customAgents?: unknown }).customAgents;
  if (!Array.isArray(agents)) return { customAgents: [] };
  return { customAgents: agents.filter(isCustomAgent) };
}

export async function readConfig(dataDir: string): Promise<AppConfig> {
  const read = await readJsonOrNull(configPath(dataDir));
  if (!read || !read.ok) return { customAgents: [] };
  return sanitizeConfig(read.value);
}

export async function writeConfig(dataDir: string, config: AppConfig): Promise<void> {
  const target = configPath(dataDir);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sanitizeConfig(config), null, 2), 'utf8');
  await fs.rename(tmp, target);
}
