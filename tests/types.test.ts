import { describe, expect, it } from 'vitest';
import type { Resource, ScanResult, SkillResource } from '../src/core/types';

describe('领域模型', () => {
  it('SkillResource 可被判别为 skill 类型', () => {
    const skill: SkillResource = {
      id: 'skill:c:/users/bai/.claude/skills/demo',
      type: 'skill',
      name: 'demo',
      description: '示例',
      path: 'C:/Users/BAI/.claude/skills/demo',
      rawPaths: ['C:/Users/BAI/.claude/skills/demo'],
      usedBy: ['claude', 'lingma'],
      scope: 'user',
      mtimeMs: 1,
      contentHash: 'abc',
      readOnly: false,
      frontmatter: { name: 'demo' },
      body: '正文',
    };

    const asResource: Resource = skill;
    expect(asResource.type).toBe('skill');
    expect(skill.usedBy).toContain('lingma');
  });

  it('ScanResult 汇总 agents / resources / issues', () => {
    const result: ScanResult = {
      scannedAt: 0,
      durationMs: 0,
      agents: [],
      resources: [],
      issues: [],
    };
    expect(result.resources).toHaveLength(0);
  });
});
