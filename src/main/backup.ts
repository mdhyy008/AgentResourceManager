import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readJsonOrNull, readTextOrNull } from '../core/fs-utils';
import type { OperationRecord, UndoResult, WriteKind } from '../shared/ipc';
import { atomicWriteText } from './atomic';

/**
 * 写入的「后悔药」：每次落盘前先把原文件复制到数据目录，并记一条操作日志。
 * 撤销就是把副本搬回去（写之前文件不存在的话，撤销就是删掉它）。
 */

function opsFile(dataDir: string): string {
  return path.join(dataDir, 'operations.json');
}

function isRecord(v: unknown): v is OperationRecord {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as Partial<OperationRecord>;
  return (
    typeof r.id === 'string' &&
    typeof r.at === 'number' &&
    typeof r.kind === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.targetPath === 'string' &&
    (r.backupPath === null || typeof r.backupPath === 'string') &&
    typeof r.undone === 'boolean'
  );
}

export async function readOperations(dataDir: string): Promise<OperationRecord[]> {
  const read = await readJsonOrNull(opsFile(dataDir));
  if (!read || !read.ok || !Array.isArray(read.value)) return [];
  return (read.value as unknown[]).filter(isRecord);
}

async function writeOperations(dataDir: string, ops: OperationRecord[]): Promise<void> {
  await atomicWriteText(opsFile(dataDir), JSON.stringify(ops, null, 2));
}

export function newOperationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 把 sourcePath 的当前内容存一份副本；文件不存在则返回 null */
export async function snapshotFile(
  dataDir: string,
  opId: string,
  sourcePath: string,
): Promise<string | null> {
  const text = await readTextOrNull(sourcePath);
  if (text === null) return null;
  const dir = path.join(dataDir, 'backups', opId);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, path.basename(sourcePath));
  await fs.writeFile(target, text, 'utf8');
  return target;
}

export async function appendOperation(
  dataDir: string,
  record: OperationRecord,
): Promise<void> {
  const ops = await readOperations(dataDir);
  ops.push(record);
  await writeOperations(dataDir, ops);
}

/** 丢弃某次操作的备份副本（写入失败时清理，避免留下孤儿目录） */
export async function discardSnapshot(dataDir: string, opId: string): Promise<void> {
  await fs.rm(path.join(dataDir, 'backups', opId), { recursive: true, force: true });
}

export async function undoOperation(dataDir: string, id: string): Promise<UndoResult> {
  const ops = await readOperations(dataDir);
  const record = ops.find((o) => o.id === id);
  if (!record) return { ok: false, message: '找不到该操作记录' };
  if (record.undone) return { ok: false, message: '该操作已经撤销过了' };

  try {
    if (record.backupPath === null) {
      // 写之前目标不存在，撤销即删除。用 recursive 是因为目标可能是
      // 新建的目录（共享 skill 时的联接/复制）；对普通文件无影响。
      await fs.rm(record.targetPath, { recursive: true, force: true });
    } else {
      const content = await readTextOrNull(record.backupPath);
      if (content === null) return { ok: false, message: '备份副本已丢失，无法撤销' };
      await atomicWriteText(record.targetPath, content);
    }
  } catch (err) {
    return { ok: false, message: `撤销失败：${(err as Error).message}` };
  }

  await writeOperations(
    dataDir,
    ops.map((o) => (o.id === id ? { ...o, undone: true, undoneAt: Date.now() } : o)),
  );
  return { ok: true, message: `已撤销：${record.summary}` };
}

export function makeRecord(params: {
  id: string;
  kind: WriteKind;
  summary: string;
  targetPath: string;
  backupPath: string | null;
}): OperationRecord {
  return {
    id: params.id,
    at: Date.now(),
    kind: params.kind,
    summary: params.summary,
    targetPath: params.targetPath,
    backupPath: params.backupPath,
    undone: false,
  };
}
