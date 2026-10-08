import type { Resource, SkillResource } from '../../core/types';
import type { WriteRequest } from '../../shared/ipc';
import { TYPE_LABELS } from './filter';
import { toggleSkill } from './write';

/** 批量里的一条：选中项 + 它对应的写入请求 */
export interface BatchItem {
  id: string;
  name: string;
  request: WriteRequest;
}

/** 被跳过的选中项，连同跳过的原因，一并报给用户 */
export interface BatchSkip {
  id: string;
  name: string;
  reason: string;
}

export interface BatchOutcome {
  id: string;
  name: string;
  ok: boolean;
  message: string;
}

export interface BatchPlan {
  items: BatchItem[];
  skipped: BatchSkip[];
}

export interface BatchSummary {
  ok: number;
  failed: number;
  skipped: BatchSkip[];
  outcomes: BatchOutcome[];
}

export type BatchAction = 'enable' | 'disable' | 'share';

function isDisabled(s: SkillResource): boolean {
  return s.frontmatter['disable-model-invocation'] === true;
}

/**
 * 启用/禁用只对可写的 skill 有意义：其它类型、插件只读的 skill、
 * 以及已经处于目标状态的项都归入 skipped，并说明原因而不是直接静默丢掉。
 */
export function planToggleBatch(resources: Resource[], enabled: boolean): BatchPlan {
  const items: BatchItem[] = [];
  const skipped: BatchSkip[] = [];

  for (const r of resources) {
    if (r.type !== 'skill') {
      skipped.push({ id: r.id, name: r.name, reason: `${TYPE_LABELS[r.type]} 不支持启用/禁用` });
      continue;
    }
    if (r.readOnly) {
      skipped.push({ id: r.id, name: r.name, reason: '插件自带的 skill 只读' });
      continue;
    }
    if (isDisabled(r) === !enabled) {
      skipped.push({ id: r.id, name: r.name, reason: enabled ? '本来就已启用' : '本来就已禁用' });
      continue;
    }
    items.push({ id: r.id, name: r.name, request: toggleSkill(r, enabled) });
  }

  return { items, skipped };
}

/** 共享同样只对可写的 skill 有意义 */
export function planShareBatch(
  resources: Resource[],
  targetSkillsDir: string,
  mode: 'link' | 'copy',
): BatchPlan {
  const items: BatchItem[] = [];
  const skipped: BatchSkip[] = [];

  for (const r of resources) {
    if (r.type !== 'skill') {
      skipped.push({ id: r.id, name: r.name, reason: `${TYPE_LABELS[r.type]} 不是 skill` });
      continue;
    }
    if (r.readOnly) {
      skipped.push({ id: r.id, name: r.name, reason: '插件自带的 skill 只读' });
      continue;
    }
    items.push({
      id: r.id,
      name: r.name,
      request: { kind: 'skill-share', sourceDir: r.path, targetSkillsDir, mode },
    });
  }

  return { items, skipped };
}

/**
 * 串行执行一批写入，逐条收集结果——一条失败不影响其余继续。
 *
 * 刻意串行而非并发：同一批里后面的项可能依赖前面项的落盘结果
 * （多个 skill 共享到同一个目标目录时，要先有人把目录建出来）。
 */
export async function runBatch(
  plan: BatchPlan,
  apply: (request: WriteRequest) => Promise<{ ok: boolean; message: string }>,
): Promise<BatchSummary> {
  const outcomes: BatchOutcome[] = [];

  for (const item of plan.items) {
    try {
      const result = await apply(item.request);
      outcomes.push({ id: item.id, name: item.name, ok: result.ok, message: result.message });
    } catch (err) {
      outcomes.push({ id: item.id, name: item.name, ok: false, message: (err as Error).message });
    }
  }

  const ok = outcomes.filter((o) => o.ok).length;
  return { ok, failed: outcomes.length - ok, skipped: plan.skipped, outcomes };
}
