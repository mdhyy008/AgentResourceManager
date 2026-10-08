import * as path from 'node:path';
import { registeredAdapters } from '../core/adapters';
import type { Adapter } from '../core/adapters/types';
import { readCache, writeCache } from '../core/cache';
import { exists, homeDir } from '../core/fs-utils';
import { runScan } from '../core/scan';
import type { AdapterPaths } from '../core/types';
import type { AppConfig, CustomAgentConfig, ScanState } from '../shared/ipc';

const DATA_DIR_NAME = '.agent-resource-manager';

export function dataDir(home = homeDir()): string {
  return path.join(home, DATA_DIR_NAME);
}

/**
 * 把用户登记的配置包成一个 adapter。root 用绝对路径，
 * 子目录则相对 root 解析——这样配置整体搬家时只需改 root。
 */
export function customAdapter(cfg: CustomAgentConfig): Adapter {
  return {
    id: cfg.id,
    name: cfg.name,
    async detect() {
      if (!(await exists(cfg.root))) return null;
      const paths: AdapterPaths = {};
      if (cfg.skillsSubdir && cfg.skillsSubdir.trim()) {
        paths.skills = path.join(cfg.root, cfg.skillsSubdir);
      }
      const mcpFiles = (cfg.mcpFiles ?? [])
        .filter((f) => f.trim().length > 0)
        .map((f) => path.join(cfg.root, f));
      if (mcpFiles.length > 0) paths.mcpFiles = mcpFiles;
      return paths;
    },
  };
}

export function buildAdapters(config: AppConfig): Adapter[] {
  return [...registeredAdapters, ...config.customAgents.map(customAdapter)];
}

/** 只读磁盘缓存，不触发扫描——用于启动时先把上次结果秒显出来 */
export async function loadCachedScan(dir: string): Promise<ScanState> {
  try {
    const result = await readCache(dir);
    return result
      ? { status: 'done', result, fromCache: true }
      : { status: 'idle', result: null, fromCache: true };
  } catch (err) {
    return { status: 'error', result: null, fromCache: true, error: (err as Error).message };
  }
}

/** 全量扫描并写回缓存 */
export async function runFullScan(dir: string, config: AppConfig): Promise<ScanState> {
  try {
    const result = await runScan({ adapters: buildAdapters(config) });
    await writeCache(dir, result);
    return { status: 'done', result, fromCache: false };
  } catch (err) {
    return { status: 'error', result: null, fromCache: false, error: (err as Error).message };
  }
}
