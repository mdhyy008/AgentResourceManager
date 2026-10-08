import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readJsonOrNull } from './fs-utils';
import type { ScanResult } from './types';

const CACHE_FILE = path.join('cache', 'scan.json');

function cachePath(dataDir: string): string {
  return path.join(dataDir, CACHE_FILE);
}

/**
 * 写缓存。走「先写临时文件再 rename」的原子替换，
 * 避免进程被中断时留下半个 JSON 导致下次启动读到损坏的缓存。
 */
export async function writeCache(
  dataDir: string,
  result: ScanResult,
): Promise<void> {
  const target = cachePath(dataDir);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(result, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

/**
 * 读缓存。任何问题（不存在、JSON 损坏、结构不对）都返回 null，
 * 让调用方退化成「重新扫描」而不是报错。
 */
export async function readCache(dataDir: string): Promise<ScanResult | null> {
  const read = await readJsonOrNull(cachePath(dataDir));
  if (!read || !read.ok) return null;

  const value = read.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<ScanResult>;
  if (
    typeof candidate.scannedAt !== 'number' ||
    !Array.isArray(candidate.resources) ||
    !Array.isArray(candidate.agents) ||
    !Array.isArray(candidate.issues)
  ) {
    return null;
  }

  return candidate as ScanResult;
}
