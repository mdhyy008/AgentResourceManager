import { describe, expect, it, vi } from 'vitest';
import type { MemoryResource, SkillResource } from '../src/core/types';
import type { WriteRequest } from '../src/shared/ipc';
import { planShareBatch, planToggleBatch, runBatch } from '../src/renderer/lib/batch';

const NO_EXPECT = { mtimeMs: 0, contentHash: '' };

function skill(overrides: Partial<SkillResource> & { id: string }): SkillResource {
  return {
    type: 'skill',
    name: overrides.name ?? overrides.id,
    path: overrides.path ?? `C:/skills/${overrides.id}`,
    rawPaths: [],
    usedBy: ['claude'],
    scope: 'user',
    mtimeMs: 1,
    contentHash: 'hash',
    frontmatter: {},
    body: '',
    readOnly: false,
    ...overrides,
  };
}

function memory(id: string): MemoryResource {
  return {
    id,
    type: 'memory',
    name: id,
    path: `C:/memory/${id}`,
    rawPaths: [],
    usedBy: ['claude'],
    scope: 'user',
    mtimeMs: 1,
    contentHash: 'h',
    kind: 'note',
    body: '',
  };
}

describe('planToggleBatch', () => {
  it('非 skill 一律跳过，并带上类型说明', () => {
    const plan = planToggleBatch([memory('m1')], false);
    expect(plan.items).toHaveLength(0);
    expect(plan.skipped).toEqual([{ id: 'm1', name: 'm1', reason: '记忆 不支持启用/禁用' }]);
  });

  it('插件自带的只读 skill 跳过', () => {
    const plan = planToggleBatch([skill({ id: 's1', readOnly: true })], true);
    expect(plan.items).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('插件自带的 skill 只读');
  });

  it('已经处于目标状态的项跳过，并说明原因', () => {
    const enabled = skill({ id: 's1' });
    const disabled = skill({ id: 's2', frontmatter: { 'disable-model-invocation': true } });

    // 启用一个没被禁用的 → 本来就已启用
    expect(planToggleBatch([enabled], true).skipped[0].reason).toBe('本来就已启用');
    // 禁用一个已经禁用的 → 本来就已禁用
    expect(planToggleBatch([disabled], false).skipped[0].reason).toBe('本来就已禁用');

    // 反向都是真正要改的，进 items
    expect(planToggleBatch([enabled], false).items).toHaveLength(1);
    expect(planToggleBatch([disabled], true).items).toHaveLength(1);
  });

  it('可写 skill 生成带 expect 的启用/禁用请求', () => {
    const r = skill({ id: 's1', path: 'C:/skills/demo', mtimeMs: 7, contentHash: 'abc' });
    const plan = planToggleBatch([r], false);
    expect(plan.items[0].request).toEqual({
      kind: 'skill-enabled',
      skillDir: 'C:/skills/demo',
      expect: { mtimeMs: 7, contentHash: 'abc' },
      enabled: false,
    });
    expect(plan.skipped).toHaveLength(0);
  });
});

describe('planShareBatch', () => {
  it('只对可写 skill 生效，其余按原因跳过', () => {
    const plan = planShareBatch(
      [skill({ id: 's1', path: 'C:/skills/demo' }), memory('m1')],
      'C:/target-skills',
      'link',
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].request).toEqual({
      kind: 'skill-share',
      sourceDir: 'C:/skills/demo',
      targetSkillsDir: 'C:/target-skills',
      mode: 'link',
    });
    expect(plan.skipped).toEqual([{ id: 'm1', name: 'm1', reason: '记忆 不是 skill' }]);
  });

  it('只读 skill 跳过', () => {
    const plan = planShareBatch([skill({ id: 's1', readOnly: true })], 'C:/t', 'copy');
    expect(plan.items).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('插件自带的 skill 只读');
  });
});

describe('runBatch', () => {
  function planOf(dirs: string[]) {
    return {
      items: dirs.map((dir, i) => ({
        id: `s${i}`,
        name: `S${i}`,
        request: { kind: 'skill-enabled', skillDir: dir, expect: NO_EXPECT, enabled: true } as WriteRequest,
      })),
      skipped: [{ id: 'x', name: 'X', reason: '不是 skill' }],
    };
  }

  it('逐条收集结果，一条失败不影响其余，统计正确', async () => {
    const apply = vi.fn(async (request: WriteRequest) => {
      const dir = (request as { skillDir: string }).skillDir;
      return dir === 'C:/b' ? { ok: false, message: '文件已被外部修改' } : { ok: true, message: '已写入' };
    });

    const summary = await runBatch(planOf(['C:/a', 'C:/b', 'C:/c']), apply);

    expect(apply).toHaveBeenCalledTimes(3);
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.outcomes.map((o) => o.ok)).toEqual([true, false, true]);
    expect(summary.outcomes[1].message).toBe('文件已被外部修改');
    expect(summary.skipped).toEqual([{ id: 'x', name: 'X', reason: '不是 skill' }]);
  });

  it('抛异常的项记为失败，后续照常执行', async () => {
    const apply = vi.fn(async (request: WriteRequest) => {
      const dir = (request as { skillDir: string }).skillDir;
      if (dir === 'C:/b') throw new Error('IPC 断开');
      return { ok: true, message: '已写入' };
    });

    const summary = await runBatch(planOf(['C:/a', 'C:/b', 'C:/c']), apply);

    expect(apply).toHaveBeenCalledTimes(3);
    expect(summary.outcomes[1]).toMatchObject({ ok: false, message: 'IPC 断开' });
    expect(summary.ok).toBe(2);
  });

  it('串行执行：同一时刻只有一个写入在飞', async () => {
    let active = 0;
    let maxActive = 0;
    const apply = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { ok: true, message: '已写入' };
    });

    await runBatch(planOf(['C:/a', 'C:/b', 'C:/c']), apply);

    expect(maxActive).toBe(1);
  });

  it('空计划返回全零', async () => {
    const summary = await runBatch({ items: [], skipped: [] }, vi.fn());
    expect(summary).toEqual({ ok: 0, failed: 0, skipped: [], outcomes: [] });
  });
});
