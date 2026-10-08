import { describe, expect, it } from 'vitest';
import { mergeResources } from '../src/core/dedupe';
import type { SkillResource } from '../src/core/types';

const make = (over: Partial<SkillResource>): SkillResource => ({
  id: 'skill:c:/x',
  type: 'skill',
  name: 'x',
  path: 'C:/x',
  rawPaths: ['C:/x'],
  usedBy: ['claude'],
  scope: 'user',
  mtimeMs: 0,
  contentHash: 'h',
  readOnly: false,
  frontmatter: {},
  body: '',
  ...over,
});

describe('mergeResources', () => {
  it('同 id 合并 usedBy 与 rawPaths', () => {
    const merged = mergeResources([
      make({ usedBy: ['claude'], rawPaths: ['C:/a'] }),
      make({ usedBy: ['lingma'], rawPaths: ['C:/b'] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.usedBy.sort()).toEqual(['claude', 'lingma']);
    expect(merged[0]!.rawPaths.sort()).toEqual(['C:/a', 'C:/b']);
  });

  it('同 id 合并时 usedBy 不产生重复项', () => {
    const merged = mergeResources([
      make({ usedBy: ['claude'] }),
      make({ usedBy: ['claude'] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.usedBy).toEqual(['claude']);
  });

  it('不同 id 各自保留', () => {
    const merged = mergeResources([make({ id: 'skill:a' }), make({ id: 'skill:b' })]);
    expect(merged).toHaveLength(2);
  });

  it('合并后保持首次出现的顺序', () => {
    const merged = mergeResources([
      make({ id: 'skill:a' }),
      make({ id: 'skill:b' }),
      make({ id: 'skill:a' }),
    ]);
    expect(merged.map((r) => r.id)).toEqual(['skill:a', 'skill:b']);
  });

  it('project scope 优先于 user scope（同一 id 时保留项目归属）', () => {
    const merged = mergeResources([
      make({ id: 'skill:a', scope: 'user' }),
      make({ id: 'skill:a', scope: 'project', projectPath: 'D:/proj' }),
    ]);
    expect(merged[0]!.scope).toBe('project');
    expect(merged[0]!.projectPath).toBe('D:/proj');
  });
});
