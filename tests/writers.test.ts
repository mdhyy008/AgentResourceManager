import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readTextOrNull, sha256 } from '../src/core/fs-utils';
import { readOperations, undoOperation } from '../src/main/backup';
import { applyWrite, previewWrite } from '../src/main/writers';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-writers-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function write(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

async function makeSkill(text: string): Promise<string> {
  const skillDir = path.join(dir, 'demo');
  await write(path.join(skillDir, 'SKILL.md'), text);
  return skillDir;
}

const FILE_BODY = '---\nname: demo\ndescription: 演示\n---\n\n正文\n';

describe('skill 写入', () => {
  it('禁用会写入 disable-model-invocation，启用会删掉它', async () => {
    const skillDir = await makeSkill(FILE_BODY);

    const disabled = await previewWrite({
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(FILE_BODY) },
      enabled: false,
    });
    expect(disabled.ok).toBe(true);
    if (!disabled.ok) return;
    expect(disabled.after).toContain('disable-model-invocation: true');

    const enabled = await previewWrite({
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(FILE_BODY) },
      enabled: true,
    });
    expect(enabled.ok).toBe(false);
  });

  it('从禁用态启用会移除开关，其余 frontmatter 保持不变', async () => {
    const text = '---\nname: demo\ndescription: 演示\ndisable-model-invocation: true\n---\n\n正文\n';
    const skillDir = await makeSkill(text);

    const plan = await previewWrite({
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(text) },
      enabled: true,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.after).not.toContain('disable-model-invocation');
    expect(plan.after).toContain('name: demo');
    expect(plan.after).toContain('正文');
  });

  it('frontmatter 编辑按整份替换', async () => {
    const skillDir = await makeSkill(FILE_BODY);
    const plan = await previewWrite({
      kind: 'skill-frontmatter',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(FILE_BODY) },
      frontmatter: { name: 'demo', description: '改过了', allowedTools: ['Read'] },
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.after).toContain('description: 改过了');
    expect(plan.after).toContain('allowedTools');
  });

  it('哈希对不上时报冲突且不落盘', async () => {
    const skillDir = await makeSkill(FILE_BODY);
    const plan = await applyWrite(dir, {
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256('别的文件') },
      enabled: false,
    });
    expect(plan.ok).toBe(false);
    expect((await readTextOrNull(path.join(skillDir, 'SKILL.md'))) === FILE_BODY).toBe(true);
  });

  it('CRLF 换行的文件写回后仍是 CRLF，diff 只加了一行', async () => {
    const crlf = FILE_BODY.replace(/\n/g, '\r\n');
    const skillDir = await makeSkill(crlf);

    const plan = await previewWrite({
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(crlf) },
      enabled: false,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.after).toContain('\r\n');
    expect(plan.after.replace(/\r\n/g, '\n')).not.toBe(crlf.replace(/\r\n/g, '\n'));
    // 未改动的部分必须逐字节保留，否则整份文件都会变成 diff
    expect(plan.after).toContain('name: demo\r\n');
    expect(plan.after.split('\r\n').length).toBe(crlf.split('\r\n').length + 1);

    const applied = await applyWrite(dir, {
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(crlf) },
      enabled: false,
    });
    expect(applied.ok).toBe(true);
    const written = await readTextOrNull(path.join(skillDir, 'SKILL.md'));
    expect(written).toContain('disable-model-invocation: true\r\n');
    expect(written).not.toContain('\n\n---');
  });

  it('BOM 会被保留', async () => {
    const withBom = `﻿${FILE_BODY}`;
    const skillDir = await makeSkill(withBom);
    const applied = await applyWrite(dir, {
      kind: 'skill-enabled',
      skillDir,
      expect: { mtimeMs: 0, contentHash: sha256(withBom) },
      enabled: false,
    });
    expect(applied.ok).toBe(true);
    const written = (await readTextOrNull(path.join(skillDir, 'SKILL.md')))!;
    expect(written.startsWith('﻿')).toBe(true);
    expect(written.replace('﻿', '')).toContain('disable-model-invocation: true');
  });
});

describe('memory 写入', () => {
  it('整体替换正文并留下可撤销的操作记录', async () => {
    const file = path.join(dir, 'memos', 'note.md');
    await write(file, '旧内容\n');

    const result = await applyWrite(dir, {
      kind: 'memory-body',
      filePath: file,
      expect: { mtimeMs: 0, contentHash: sha256('旧内容\n') },
      body: '新内容\n',
    });
    expect(result.ok).toBe(true);
    expect(result.operationId).toBeTruthy();
    expect(await readTextOrNull(file)).toBe('新内容\n');

    const ops = await readOperations(dir);
    expect(ops).toHaveLength(1);
    expect(ops[0].backupPath).not.toBeNull();

    const undo = await undoOperation(dir, result.operationId!);
    expect(undo.ok).toBe(true);
    expect(await readTextOrNull(file)).toBe('旧内容\n');
  });

  it('CRLF 的记忆文件写回后仍是 CRLF', async () => {
    const file = path.join(dir, 'memos', 'crlf.md');
    const original = '第一行\r\n第二行\r\n';
    await write(file, original);

    const result = await applyWrite(dir, {
      kind: 'memory-body',
      filePath: file,
      expect: { mtimeMs: 0, contentHash: sha256(original) },
      // 编辑框拿到的正文是 LF（浏览器会把 \r 去掉）
      body: '第一行\n第二行改过了\n',
    });
    expect(result.ok).toBe(true);
    expect(await readTextOrNull(file)).toBe('第一行\r\n第二行改过了\r\n');
  });

  it('正文没改时会拒绝写入，而不是把整份文件重写一遍', async () => {
    const file = path.join(dir, 'memos', 'crlf2.md');
    const original = '第一行\r\n第二行\r\n';
    await write(file, original);
    const result = await applyWrite(dir, {
      kind: 'memory-body',
      filePath: file,
      expect: { mtimeMs: 0, contentHash: sha256(original) },
      body: '第一行\n第二行\n',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('没有变化');
    expect(await readTextOrNull(file)).toBe(original);
  });
});

describe('MCP 写入', () => {
  const emptyMcp = '{\n  "mcpServers": {}\n}\n';

  it('从零新建 server（expect 为 null）', async () => {
    const file = path.join(dir, 'mcp.json');
    await write(file, emptyMcp);

    const plan = await applyWrite(dir, {
      kind: 'mcp-add',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'ctx7',
      expect: null,
      entry: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
    });
    expect(plan.ok).toBe(true);

    const after = JSON.parse((await readTextOrNull(file))!) as {
      mcpServers: Record<string, unknown>;
    };
    expect(after.mcpServers.ctx7).toEqual({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    });
  });

  it('新增时保留文件里其它顶层键', async () => {
    const file = path.join(dir, 'mcp.json');
    await write(file, '{\n  "mcpServers": {},\n  "other": { "keep": true }\n}\n');

    await applyWrite(dir, {
      kind: 'mcp-add',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'a',
      expect: null,
      entry: { command: 'a' },
    });

    const after = JSON.parse((await readTextOrNull(file))!) as Record<string, unknown>;
    expect(after.other).toEqual({ keep: true });
  });

  it('同名 server 会被拒绝', async () => {
    const file = path.join(dir, 'mcp.json');
    await write(file, '{\n  "mcpServers": {\n    "a": {\n      "command": "a"\n    }\n  }\n}\n');
    const text = (await readTextOrNull(file))!;

    const result = await applyWrite(dir, {
      kind: 'mcp-add',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'a',
      expect: { mtimeMs: 0, contentHash: sha256(JSON.stringify({ a: { command: 'a' } })) },
      entry: { command: 'b' },
    });
    expect(result.ok).toBe(false);
    expect(await readTextOrNull(file)).toBe(text);
  });

  it('删除 server 后仍保留其余项', async () => {
    const file = path.join(dir, 'mcp.json');
    const raw = { a: { command: 'a' }, b: { command: 'b' } };
    await write(file, `${JSON.stringify({ mcpServers: raw }, null, 2)}\n`);

    const result = await applyWrite(dir, {
      kind: 'mcp-remove',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'a',
      expect: { mtimeMs: 0, contentHash: sha256(JSON.stringify(raw)) },
    });
    expect(result.ok).toBe(true);

    const after = JSON.parse((await readTextOrNull(file))!) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(after.mcpServers)).toEqual(['b']);
  });

  it('删除不存在的 server 会被拒绝', async () => {
    const file = path.join(dir, 'mcp.json');
    const raw = { a: { command: 'a' } };
    await write(file, `${JSON.stringify({ mcpServers: raw }, null, 2)}\n`);
    const result = await applyWrite(dir, {
      kind: 'mcp-remove',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'ghost',
      expect: { mtimeMs: 0, contentHash: sha256(JSON.stringify(raw)) },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('找不到');
  });

  it('子树哈希对不上时报冲突', async () => {
    const file = path.join(dir, 'mcp.json');
    await write(file, emptyMcp);
    const result = await applyWrite(dir, {
      kind: 'mcp-add',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'x',
      expect: { mtimeMs: 0, contentHash: sha256(JSON.stringify({ 已有: {} })) },
      entry: { command: 'x' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('重新扫描');
  });

  it('撤销会恢复写入前的文件', async () => {
    const file = path.join(dir, 'mcp.json');
    await write(file, emptyMcp);
    const result = await applyWrite(dir, {
      kind: 'mcp-add',
      configPath: file,
      configPointer: ['mcpServers'],
      serverName: 'ctx7',
      expect: null,
      entry: { command: 'npx' },
    });
    expect(result.ok).toBe(true);

    const undo = await undoOperation(dir, result.operationId!);
    expect(undo.ok).toBe(true);
    expect(await readTextOrNull(file)).toBe(emptyMcp);
  });
});
