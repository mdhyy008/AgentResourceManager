import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * 把路径规范化成用于「比较」的 key。
 * Windows 文件系统大小写不敏感，所以统一小写，否则同一个目录会被算成两个。
 */
export function normalizeKey(p: string): string {
  const abs = path.resolve(p);
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
}

/** 用于「展示/id」的规范化路径：转绝对路径，但保留原始大小写 */
export function displayPath(p: string): string {
  return path.resolve(p).split(path.sep).join('/');
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** lstat，失败返回 null（不抛） */
export async function statOrNull(
  p: string,
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(p);
  } catch {
    return null;
  }
}

/** 解析真实路径（解开符号链接/junction），失败（含断链）返回 null */
export async function realpathOrNull(p: string): Promise<string | null> {
  try {
    return await fs.realpath(p);
  } catch {
    return null;
  }
}

/**
 * 判断路径是否是一个链接（符号链接或 Windows junction）。
 * 除了 lstat 检查，还兜底比较 realpath 与自身：junction 在某些 Node 版本上
 * lstat().isSymbolicLink() 未必为 true，但 realpath 一定会解析到别处。
 */
export async function isLink(p: string): Promise<boolean> {
  const st = await statOrNull(p);
  if (!st) return false;
  if (st.isSymbolicLink()) return true;
  const real = await realpathOrNull(p);
  if (!real) return false;
  return normalizeKey(real) !== normalizeKey(p);
}

/** 列目录，返回子项绝对路径；目录不存在或不可读返回空数组 */
export async function listDir(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.map((e) => path.join(p, e.name));
  } catch {
    return [];
  }
}

/** 读文本，失败返回 null（不抛） */
export async function readTextOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

/** 读 JSON，失败或语法错误返回 null（调用方负责记 ScanIssue） */
export async function readJsonOrNull(
  p: string,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string } | null> {
  const text = await readTextOrNull(p);
  if (text === null) return null;
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function homeDir(): string {
  return os.homedir();
}
