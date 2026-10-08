import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readTextOrNull } from '../core/fs-utils';
import type { ResourceType, ScanResult } from '../core/types';
import { createZip, type ZipEntry } from './zip';

export const EXPORT_TOOL = 'agent-resource-manager';
export const EXPORT_VERSION = '0.1.0';

/** 打包某个 skill 目录时跳过的子目录：这些要么巨大，要么是别人重新装得出来的 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '__pycache__', '.idea', '.vscode']);

/** Windows 文件名里不允许出现的字符 */
const ILLEGAL_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export interface ExportManifestFile {
  /** 归档内路径 */
  archivePath: string;
  type: ResourceType;
  resourceId: string;
  name: string;
  scope: string;
  /** 来源文件的绝对路径，方便溯源 */
  originPath: string;
  /** MCP 专用的 JSON 指针 */
  pointer?: string[];
  bytes: number;
}

export interface ExportManifest {
  tool: string;
  version: string;
  exportedAt: number;
  types: ResourceType[];
  counts: Record<string, number>;
  files: ExportManifestFile[];
  /** 只写进 manifest、没有打包内容的项 */
  metadataOnly: Array<{ type: ResourceType; name: string; note: string }>;
  /** 想导出但跳过的项及原因 */
  skipped: Array<{ path: string; reason: string }>;
  warnings: string[];
}

/** 打包源：递归目录 / 单个文件 / 直接内联的内容 */
type PlannedSource =
  | { kind: 'dir'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'inline'; text: string };

export interface PlannedFile {
  archivePath: string;
  type: ResourceType;
  resourceId: string;
  name: string;
  scope: string;
  originPath: string;
  source: PlannedSource;
  pointer?: string[];
}

export interface ArchivePlan {
  files: PlannedFile[];
  metadataOnly: ExportManifest['metadataOnly'];
  skipped: ExportManifest['skipped'];
}

function shortHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 8);
}

/** 去掉 Windows 不允许的字符，并避免首尾的点和空格（Windows 会静默吃掉） */
export function sanitizeSegment(segment: string): string {
  let cleaned = '';
  for (const ch of segment) {
    const code = ch.codePointAt(0) ?? 0;
    cleaned += code < 0x20 || ILLEGAL_CHARS.has(ch) ? '-' : ch;
  }
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  return cleaned === '' ? 'unnamed' : cleaned.slice(0, 80);
}

/** 按 configPointer 逐层包起来，得到 `{ "projects": { "D:/x": { "mcpServers": {...} } } }` */
export function nestPointer(pointer: string[], value: unknown): unknown {
  let node = value;
  for (let i = pointer.length - 1; i >= 0; i -= 1) node = { [pointer[i] as string]: node };
  return node;
}

/**
 * 只根据扫描结果算出「要打包哪些文件」，不碰磁盘——这样这部分能单独测。
 * 目录内实际有哪些文件是 buildExport 阶段才知道的。
 */
export function planArchive(result: ScanResult, types: ResourceType[]): ArchivePlan {
  const wanted = new Set(types);
  const files: PlannedFile[] = [];
  const metadataOnly: ArchivePlan['metadataOnly'] = [];
  const skipped: ArchivePlan['skipped'] = [];

  // 按 id 排序，保证同名资源的编号在每次导出之间稳定
  const resources = [...result.resources].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const used = new Set<string>();

  const unique = (candidate: string): string => {
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    for (let n = 2; ; n += 1) {
      const next = `${candidate}-${n}`;
      if (!used.has(next)) {
        used.add(next);
        return next;
      }
    }
  };

  for (const r of resources) {
    if (!wanted.has(r.type)) continue;

    if (r.type === 'skill') {
      if (r.readOnly) {
        skipped.push({ path: r.path, reason: '插件提供的 skill，只记录在 manifest 里，不打包内容' });
        continue;
      }
      files.push({
        archivePath: `skills/${unique(sanitizeSegment(path.basename(r.path)))}`,
        type: 'skill',
        resourceId: r.id,
        name: r.name,
        scope: r.scope,
        originPath: r.path,
        source: { kind: 'dir', path: r.path },
      });
      continue;
    }

    if (r.type === 'memory') {
      files.push({
        archivePath: `memory/${unique(sanitizeSegment(path.basename(r.path)))}`,
        type: 'memory',
        resourceId: r.id,
        name: r.name,
        scope: r.scope,
        originPath: r.path,
        source: { kind: 'file', path: r.path },
      });
      continue;
    }

    if (r.type === 'mcp') {
      // 只导出 mcpServers 这一段，不整份复制配置文件——
      // ~/.claude.json 里还有项目历史和凭据，与 MCP 无关，不该跟着出走。
      const servers = Object.fromEntries(r.servers.map((s) => [s.name, s.raw]));
      const key = `${r.configPath}#${r.configPointer.join('.')}`;
      files.push({
        archivePath: `mcp/${unique(sanitizeSegment(r.name))}-${shortHash(key)}.json`,
        type: 'mcp',
        resourceId: r.id,
        name: r.name,
        scope: r.scope,
        originPath: r.configPath,
        pointer: r.configPointer,
        source: {
          kind: 'inline',
          text: `${JSON.stringify(nestPointer(r.configPointer, servers), null, 2)}\n`,
        },
      });
      continue;
    }

    metadataOnly.push({
      type: 'plugin',
      name: r.name,
      note: `插件 ${r.pluginId}@${r.version}（${r.marketplace}）—— 只记录元数据，插件内容可从市场重装`,
    });
  }

  return { files, metadataOnly, skipped };
}

interface WalkedFile {
  rel: string;
  data: Buffer;
}

/** 递归收集目录下的文件；跳过符号链接（避免顺着链接把无关文件也卷进来）和重型目录 */
async function walkDir(dir: string, rel = ''): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    const nextRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await walkDir(full, nextRel)));
    } else if (entry.isFile()) {
      try {
        out.push({ rel: nextRel, data: await fs.readFile(full) });
      } catch {
        // 单个文件读不了不该让整次导出失败
      }
    }
  }
  return out;
}

/**
 * 打出导出包的字节与 manifest。
 *
 * 这个函数就是「同步」预留的接口：将来要接远端同步时，
 * 直接把这堆字节发出去即可，不需要动打包逻辑本身。
 */
export async function buildExport(
  result: ScanResult,
  types: ResourceType[],
  now = new Date(),
): Promise<{ bytes: Uint8Array; manifest: ExportManifest }> {
  const plan = planArchive(result, types);
  const entries: ZipEntry[] = [];
  const manifestFiles: ExportManifestFile[] = [];
  const skipped = [...plan.skipped];
  const counts: Record<string, number> = {};

  const record = (file: PlannedFile, archivePath: string, bytes: number) => {
    manifestFiles.push({
      archivePath,
      type: file.type,
      resourceId: file.resourceId,
      name: file.name,
      scope: file.scope,
      originPath: file.originPath,
      pointer: file.pointer,
      bytes,
    });
    counts[file.type] = (counts[file.type] ?? 0) + 1;
  };

  for (const file of plan.files) {
    if (file.source.kind === 'inline') {
      const data = Buffer.from(file.source.text, 'utf8');
      entries.push({ name: file.archivePath, data });
      record(file, file.archivePath, data.length);
      continue;
    }

    if (file.source.kind === 'file') {
      const text = await readTextOrNull(file.source.path);
      if (text === null) {
        skipped.push({ path: file.source.path, reason: '读取失败，已跳过' });
        continue;
      }
      const data = Buffer.from(text, 'utf8');
      entries.push({ name: file.archivePath, data });
      record(file, file.archivePath, data.length);
      continue;
    }

    const walked = await walkDir(file.source.path);
    if (walked.length === 0) {
      skipped.push({ path: file.source.path, reason: '目录为空或不可读，已跳过' });
      continue;
    }
    let total = 0;
    for (const item of walked) {
      entries.push({ name: `${file.archivePath}/${item.rel}`, data: item.data });
      total += item.data.length;
    }
    record(file, `${file.archivePath}/`, total);
  }

  const warnings: string[] = [];
  if ((counts.mcp ?? 0) > 0) {
    warnings.push('MCP 配置里的 env、headers 是明文写进归档的，含密钥时请勿外发。');
  }
  if (types.includes('plugin')) {
    warnings.push('Plugins 一类只导出元数据清单，插件内容需要从市场重新安装。');
  }
  if (skipped.length > 0) {
    warnings.push(`有 ${skipped.length} 项被跳过，明细见 manifest.json 的 skipped。`);
  }

  const manifest: ExportManifest = {
    tool: EXPORT_TOOL,
    version: EXPORT_VERSION,
    exportedAt: now.getTime(),
    types,
    counts,
    files: manifestFiles,
    metadataOnly: plan.metadataOnly,
    skipped,
    warnings,
  };

  const allEntries: ZipEntry[] = [
    { name: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8') },
    ...entries,
  ];

  return { bytes: createZip(allEntries, now), manifest };
}
