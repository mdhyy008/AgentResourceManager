import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parseMemoryIndex,
  projectSlug,
  scanMemoryDir,
  scanMemoryFile,
} from '../src/core/scanners/memory';

let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-memory-'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('projectSlug', () => {
  it('把绝对路径换算成 Claude 的 slug', () => {
    expect(projectSlug('D:/other/code/win/AgentResourceManager')).toBe(
      'D--other-code-win-AgentResourceManager',
    );
  });

  it('处理 Windows 反斜杠路径', () => {
    expect(projectSlug('D:\\other\\Android\\cli')).toBe('D--other-Android-cli');
  });

  it('处理盘符根路径', () => {
    expect(projectSlug('C:/Users/BAI')).toBe('C--Users-BAI');
  });
});

describe('parseMemoryIndex', () => {
  it('解析 `- [标题](文件) — 摘要` 形式的索引行', () => {
    const text = [
      '- [下载偏好](user_download_preference.md) — 默认下载到 D:\\other',
      '- [MSVC 编译体积优化](msvc-compilation-size.md) — 必须用 /MD 动态链接',
    ].join('\n');

    expect(parseMemoryIndex(text)).toEqual([
      {
        title: '下载偏好',
        file: 'user_download_preference.md',
        summary: '默认下载到 D:\\other',
      },
      {
        title: 'MSVC 编译体积优化',
        file: 'msvc-compilation-size.md',
        summary: '必须用 /MD 动态链接',
      },
    ]);
  });

  it('用普通连字符分隔也能解析', () => {
    expect(parseMemoryIndex('- [A](a.md) - 摘要')).toEqual([
      { title: 'A', file: 'a.md', summary: '摘要' },
    ]);
  });

  it('忽略不符合格式的行', () => {
    expect(parseMemoryIndex('# 标题\n不是索引行\n- [A](a.md) — 摘要')).toEqual([
      { title: 'A', file: 'a.md', summary: '摘要' },
    ]);
  });
});

describe('scanMemoryDir', () => {
  it('扫出 MEMORY.md 索引与其正文文件', async () => {
    const slugDir = path.join(tmp, 'projects', 'D--proj-a');
    const memoryDir = path.join(slugDir, 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(
      path.join(memoryDir, 'MEMORY.md'),
      '- [下载偏好](pref.md) — 默认下载到 D:\\other\n',
      'utf8',
    );
    await fs.writeFile(path.join(memoryDir, 'pref.md'), '正文内容', 'utf8');

    const { resources, issues } = await scanMemoryDir(path.join(tmp, 'projects'), {
      agentId: 'claude',
      projectPath: 'D:/proj/a',
    });

    expect(issues).toEqual([]);
    expect(resources).toHaveLength(2);

    const index = resources.find((r) => r.kind === 'index')!;
    expect(index.name).toBe('MEMORY.md');
    expect(index.indexEntries).toEqual([
      { title: '下载偏好', file: 'pref.md', summary: '默认下载到 D:\\other' },
    ]);

    const note = resources.find((r) => r.kind === 'note')!;
    expect(note.name).toBe('pref.md');
    expect(note.body).toBe('正文内容');
    expect(note.projectPath).toBe('D:/proj/a');
    expect(note.scope).toBe('project');
  });

  it('只扫 projectPath 对应的 slug 目录，忽略其他项目', async () => {
    const other = path.join(tmp, 'projects2', 'D--proj-other', 'memory');
    await fs.mkdir(other, { recursive: true });
    await fs.writeFile(path.join(other, 'x.md'), '别的项目', 'utf8');

    const { resources } = await scanMemoryDir(path.join(tmp, 'projects2'), {
      agentId: 'claude',
      projectPath: 'D:/proj/a',
    });
    expect(resources).toEqual([]);
  });

  it('目录不存在时返回空结果', async () => {
    const out = await scanMemoryDir(path.join(tmp, 'nope'), {
      agentId: 'claude',
      projectPath: 'D:/proj/a',
    });
    expect(out.resources).toEqual([]);
    expect(out.issues).toEqual([]);
  });

  it('记忆目录中含空的 MEMORY.md 时不崩', async () => {
    const memoryDir = path.join(tmp, 'projects3', 'D--proj-b', 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(path.join(memoryDir, 'MEMORY.md'), '', 'utf8');

    const { resources } = await scanMemoryDir(path.join(tmp, 'projects3'), {
      agentId: 'claude',
      projectPath: 'D:/proj/b',
    });
    expect(resources).toHaveLength(1);
    expect(resources[0]!.indexEntries).toEqual([]);
  });

  it('忽略非 .md 文件', async () => {
    const memoryDir = path.join(tmp, 'projects4', 'D--proj-c', 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(path.join(memoryDir, 'data.json'), '{}', 'utf8');

    const { resources } = await scanMemoryDir(path.join(tmp, 'projects4'), {
      agentId: 'claude',
      projectPath: 'D:/proj/c',
    });
    expect(resources).toEqual([]);
  });
});

describe('scanMemoryFile', () => {
  it('扫单个记忆文件（如项目根的 CLAUDE.md）', async () => {
    const p = path.join(tmp, 'CLAUDE.md');
    await fs.writeFile(p, '# 项目说明\n内容', 'utf8');

    const { resources } = await scanMemoryFile(p, {
      agentId: 'claude',
      scope: 'project',
      projectPath: 'D:/proj/a',
    });
    expect(resources).toHaveLength(1);
    expect(resources[0]!.name).toBe('CLAUDE.md');
    expect(resources[0]!.kind).toBe('note');
    expect(resources[0]!.body).toBe('# 项目说明\n内容');
  });

  it('文件不存在时返回空', async () => {
    const { resources, issues } = await scanMemoryFile(path.join(tmp, 'nope.md'), {
      agentId: 'claude',
      scope: 'project',
    });
    expect(resources).toEqual([]);
    expect(issues).toEqual([]);
  });
});
