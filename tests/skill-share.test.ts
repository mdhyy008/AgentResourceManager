import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exists, isLink, readTextOrNull } from '../src/core/fs-utils';
import { readOperations, undoOperation } from '../src/main/backup';
import { applyWrite, previewWrite } from '../src/main/writers';
import type { WriteRequest } from '../src/shared/ipc';

let dir: string;
let sourceDir: string;
let targetSkills: string;

const BODY = '---\nname: demo\n---\n\n正文\n';

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-share-'));
  sourceDir = path.join(dir, 'source-skills', 'demo');
  targetSkills = path.join(dir, 'target-skills');
  await fs.mkdir(path.join(sourceDir, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'SKILL.md'), BODY, 'utf8');
  await fs.writeFile(path.join(sourceDir, 'scripts', 'run.sh'), 'echo hi\n', 'utf8');
  // 复制时这个目录应当被跳过
  await fs.mkdir(path.join(sourceDir, 'node_modules', 'junk'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'node_modules', 'junk', 'big.js'), 'no\n', 'utf8');
  await fs.mkdir(targetSkills, { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function req(mode: 'link' | 'copy'): WriteRequest {
  return { kind: 'skill-share', sourceDir, targetSkillsDir: targetSkills, mode };
}

describe('skill 共享：规划', () => {
  it('预览是文件系统改动，带出源与目标路径', async () => {
    const preview = await previewWrite(req('link'));
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.scope).toBe('fs');
    expect(preview.after).toContain(sourceDir);
    expect(preview.targetPath).toBe(path.join(targetSkills, 'demo'));
  });

  it('目标已存在同名项时拒绝，且不落盘', async () => {
    await fs.mkdir(path.join(targetSkills, 'demo'), { recursive: true });
    const result = await applyWrite(dir, req('link'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('已存在');
    // 原有的空目录不能被顶掉
    expect(await readTextOrNull(path.join(targetSkills, 'demo', 'SKILL.md'))).toBeNull();
  });

  it('源目录不存在时拒绝', async () => {
    const result = await previewWrite({
      kind: 'skill-share',
      sourceDir: path.join(dir, 'nope'),
      targetSkillsDir: targetSkills,
      mode: 'link',
    });
    expect(result.ok).toBe(false);
  });
});

describe('skill 共享：联接', () => {
  it('建成后是一个指向源目录的链接，内容可透读', async () => {
    const result = await applyWrite(dir, req('link'));
    expect(result.ok).toBe(true);
    const targetPath = path.join(targetSkills, 'demo');
    expect(await isLink(targetPath)).toBe(true);
    expect(await readTextOrNull(path.join(targetPath, 'SKILL.md'))).toBe(BODY);
    // 源目录原封不动
    expect(await readTextOrNull(path.join(sourceDir, 'SKILL.md'))).toBe(BODY);
  });

  it('撤销后链接消失，源目录还在', async () => {
    const result = await applyWrite(dir, req('link'));
    expect(result.ok).toBe(true);

    const ops = await readOperations(dir);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('skill-share');
    expect(ops[0].backupPath).toBeNull();

    const undo = await undoOperation(dir, result.operationId!);
    expect(undo.ok).toBe(true);
    expect(await exists(path.join(targetSkills, 'demo'))).toBe(false);
    expect(await exists(path.join(sourceDir, 'SKILL.md'))).toBe(true);
  });
});

describe('skill 共享：复制', () => {
  it('复制出真实目录，内容一致，node_modules 被跳过', async () => {
    const result = await applyWrite(dir, req('copy'));
    expect(result.ok).toBe(true);
    const targetPath = path.join(targetSkills, 'demo');
    expect(await isLink(targetPath)).toBe(false);
    expect(await readTextOrNull(path.join(targetPath, 'SKILL.md'))).toBe(BODY);
    expect(await readTextOrNull(path.join(targetPath, 'scripts', 'run.sh'))).toBe('echo hi\n');
    expect(await exists(path.join(targetPath, 'node_modules'))).toBe(false);
  });

  it('撤销后复制出的目录被删掉，源目录还在', async () => {
    const result = await applyWrite(dir, req('copy'));
    expect(result.ok).toBe(true);
    const undo = await undoOperation(dir, result.operationId!);
    expect(undo.ok).toBe(true);
    expect(await exists(path.join(targetSkills, 'demo'))).toBe(false);
    expect(await exists(path.join(sourceDir, 'SKILL.md'))).toBe(true);
  });

  it('复制后改源不再影响副本（两边独立）', async () => {
    const result = await applyWrite(dir, req('copy'));
    expect(result.ok).toBe(true);
    await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '改过了\n', 'utf8');
    expect(await readTextOrNull(path.join(targetSkills, 'demo', 'SKILL.md'))).toBe(BODY);
  });
});
