import type { WriteFailure, WriteKind, WritePreview } from '../../shared/ipc';

/**
 * 一次「已规划但未落盘」的写入。规划阶段只读文件、算出 before/after，不做任何修改——
 * 这样 dry-run 预览和真正写入走的是同一套逻辑，不会出现预览与实际写出不一致。
 */
export interface WritePlan {
  kind: WriteKind;
  targetPath: string;
  summary: string;
  /** before/after 是文件全文、某个子树（MCP 只展示 mcpServers 那一段），还是文件系统结构改动的文字描述 */
  scope: 'file' | 'subtree' | 'fs';
  before: string;
  after: string;
  /** 真正落盘。调用方会先做快照再调它 */
  commit(): Promise<void>;
}

export type PlanResult = { ok: true; plan: WritePlan } | WriteFailure;

export function failure(message: string, conflict = false): WriteFailure {
  return { ok: false, conflict, message };
}

export function toPreview(plan: WritePlan): WritePreview {
  return {
    ok: true,
    targetPath: plan.targetPath,
    summary: plan.summary,
    scope: plan.scope,
    before: plan.before,
    after: plan.after,
  };
}
