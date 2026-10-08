import { describe, expect, it } from 'vitest';
import type { MemoryResource, ScanIssue, SkillResource } from '../src/core/types';
import {
  countByType,
  filterResources,
  groupIssuesByKind,
  matchesQuery,
  sortResources,
  TYPE_LABELS,
} from '../src/renderer/lib/filter';

function skill(name: string, overrides: Partial<SkillResource> = {}): SkillResource {
  return {
    id: `skill:${name}`,
    type: 'skill',
    name,
    path: `C:/home/.claude/skills/${name}/SKILL.md`,
    rawPaths: [`C:/home/.claude/skills/${name}`],
    usedBy: ['claude'],
    scope: 'user',
    mtimeMs: 1,
    contentHash: 'h',
    frontmatter: {},
    body: '',
    readOnly: false,
    ...overrides,
  };
}

function memory(name: string, overrides: Partial<MemoryResource> = {}): MemoryResource {
  return {
    id: `memory:${name}`,
    type: 'memory',
    name,
    path: `C:/proj/.claude/projects/slug/memory/${name}.md`,
    rawPaths: [],
    usedBy: ['claude'],
    scope: 'project',
    projectPath: 'C:/proj',
    mtimeMs: 1,
    contentHash: 'h',
    kind: 'note',
    body: '正文',
    ...overrides,
  };
}

describe('matchesQuery', () => {
  it('空查询匹配一切', () => {
    expect(matchesQuery(skill('odai'), '   ')).toBe(true);
  });

  it('命中名称（大小写不敏感）', () => {
    expect(matchesQuery(skill('Odai'), 'ODAI')).toBe(true);
  });

  it('命中路径、描述、使用方', () => {
    const r = skill('x', { description: '安卓构建助手', usedBy: ['lingma'] });
    expect(matchesQuery(r, 'android')).toBe(false);
    expect(matchesQuery(r, '.claude')).toBe(true);
    expect(matchesQuery(r, '安卓')).toBe(true);
    expect(matchesQuery(r, 'lingma')).toBe(true);
  });

  it('中文类型标签也可被搜到', () => {
    expect(matchesQuery(memory('note-a'), TYPE_LABELS.memory)).toBe(true);
  });

  it('未命中返回 false', () => {
    expect(matchesQuery(skill('odai'), 'zzz-not-there')).toBe(false);
  });
});

describe('filterResources', () => {
  const list = [skill('a'), skill('b', { scope: 'project', projectPath: 'C:/p' }), memory('c')];

  it('不传条件时原样返回', () => {
    expect(filterResources(list)).toHaveLength(3);
  });

  it('按类型过滤', () => {
    const out = filterResources(list, { type: 'skill' });
    expect(out.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('按 scope 过滤', () => {
    expect(filterResources(list, { scope: 'project' }).map((r) => r.name)).toEqual(['b', 'c']);
    expect(filterResources(list, { scope: 'user' }).map((r) => r.name)).toEqual(['a']);
  });

  it('类型 + 查询 + scope 组合', () => {
    const out = filterResources(list, { type: 'skill', scope: 'user', query: 'A' });
    expect(out.map((r) => r.name)).toEqual(['a']);
  });

  it('按 agent 过滤：只要 usedBy 含该 agent 的', () => {
    const shared = skill('shared', { usedBy: ['claude', 'lingma'] });
    const onlyCursor = skill('cursor-only', { usedBy: ['cursor'] });
    const out = filterResources([shared, onlyCursor], { agent: 'lingma' });
    expect(out.map((r) => r.name)).toEqual(['shared']);
  });

  it('agent 传 null 等同于不按 agent 过滤', () => {
    expect(filterResources(list, { agent: null })).toHaveLength(3);
  });

  it('agent 与 type 可叠加', () => {
    const a = skill('a', { usedBy: ['claude'] });
    const b = memory('b', { usedBy: ['claude'] });
    const out = filterResources([a, b], { agent: 'claude', type: 'memory' });
    expect(out.map((r) => r.name)).toEqual(['b']);
  });
});

describe('countByType', () => {
  it('四类都给出计数，缺的补 0', () => {
    const counts = countByType([skill('a'), skill('b'), memory('c')]);
    expect(counts).toEqual({ skill: 2, mcp: 0, memory: 1, plugin: 0 });
  });
});

describe('groupIssuesByKind', () => {
  it('按 kind 分组且保持首次出现顺序', () => {
    const issues: ScanIssue[] = [
      { kind: 'bad-json', path: 'a', message: '1' },
      { kind: 'missing-manifest', path: 'b', message: '2' },
      { kind: 'bad-json', path: 'c', message: '3' },
    ];
    const grouped = groupIssuesByKind(issues);
    expect(grouped.map(([k]) => k)).toEqual(['bad-json', 'missing-manifest']);
    expect(grouped[0][1]).toHaveLength(2);
  });

  it('空输入返回空数组', () => {
    expect(groupIssuesByKind([])).toEqual([]);
  });
});

describe('sortResources', () => {
  it('按名称排序且不修改原数组', () => {
    const input = [skill('c'), skill('a'), skill('b')];
    const sorted = sortResources(input);
    expect(sorted.map((r) => r.name)).toEqual(['a', 'b', 'c']);
    expect(input.map((r) => r.name)).toEqual(['c', 'a', 'b']);
  });
});
