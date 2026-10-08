import type {
  WriteApplyResult,
  WritePreviewResult,
  WriteRequest,
} from '../../shared/ipc';
import {
  appendOperation,
  discardSnapshot,
  makeRecord,
  newOperationId,
  snapshotFile,
} from '../backup';
import { planMcpWrite } from './mcp';
import { planMemoryWrite } from './memory';
import { planSkillShare } from './skill-share';
import { planSkillWrite } from './skill';
import { toPreview, type PlanResult } from './types';

/** 只读地算出一份「将要发生的改动」，不碰任何文件 */
export async function planWrite(req: WriteRequest): Promise<PlanResult> {
  switch (req.kind) {
    case 'skill-enabled':
    case 'skill-frontmatter':
      return planSkillWrite(req);
    case 'skill-share':
      return planSkillShare(req);
    case 'memory-body':
      return planMemoryWrite(req);
    case 'mcp-add':
    case 'mcp-remove':
      return planMcpWrite(req);
  }
}

export async function previewWrite(req: WriteRequest): Promise<WritePreviewResult> {
  const planned = await planWrite(req);
  return planned.ok ? toPreview(planned.plan) : planned;
}

/**
 * 真正落盘。顺序刻意如此：先快照、再写、最后记日志。
 * 写失败时把刚建的快照目录删掉，避免留下孤儿备份。
 */
export async function applyWrite(
  dataDir: string,
  req: WriteRequest,
): Promise<WriteApplyResult> {
  const planned = await planWrite(req);
  if (!planned.ok) return { ok: false, message: planned.message };

  const plan = planned.plan;
  const id = newOperationId();
  const backupPath = await snapshotFile(dataDir, id, plan.targetPath);

  try {
    await plan.commit();
  } catch (err) {
    await discardSnapshot(dataDir, id);
    return { ok: false, message: `写入失败：${(err as Error).message}` };
  }

  await appendOperation(
    dataDir,
    makeRecord({
      id,
      kind: plan.kind,
      summary: plan.summary,
      targetPath: plan.targetPath,
      backupPath,
    }),
  );

  return { ok: true, message: plan.summary, operationId: id };
}
