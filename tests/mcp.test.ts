import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  normalizeMcpServer,
  scanMcpFromClaudeJson,
  scanMcpFromMcpJsonFile,
} from '../src/core/scanners/mcp';

let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-mcp-'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('normalizeMcpServer', () => {
  it('识别 stdio 型（有 command）', () => {
    const e = normalizeMcpServer('fs', {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: { TOKEN: 'secret-value' },
    });
    expect(e.transport).toBe('stdio');
    expect(e.command).toBe('npx');
    expect(e.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
    // 密钥不打码，原样保留（用户明确要求）
    expect(e.env).toEqual({ TOKEN: 'secret-value' });
    expect(e.raw).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: { TOKEN: 'secret-value' },
    });
  });

  it('识别 http 型（有 url 无 type）', () => {
    const e = normalizeMcpServer('remote', { url: 'https://mcp.example.com/sse' });
    expect(e.transport).toBe('http');
    expect(e.url).toBe('https://mcp.example.com/sse');
  });

  it('识别显式 type: sse', () => {
    const e = normalizeMcpServer('sse', { type: 'sse', url: 'https://x/sse' });
    expect(e.transport).toBe('sse');
  });

  it('识别 headers', () => {
    const e = normalizeMcpServer('auth', {
      type: 'http',
      url: 'https://x',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(e.headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('未知结构返回 transport: unknown 且不抛错', () => {
    const e = normalizeMcpServer('weird', { foo: 1 });
    expect(e.transport).toBe('unknown');
    expect(e.command).toBeUndefined();
    expect(e.url).toBeUndefined();
  });

  it('非对象输入不抛错', () => {
    expect(normalizeMcpServer('x', null).transport).toBe('unknown');
    expect(normalizeMcpServer('x', 'string').transport).toBe('unknown');
  });
});

describe('scanMcpFromClaudeJson', () => {
  it('扫出顶层 mcpServers（用户级）', async () => {
    const p = path.join(tmp, 'claude-user.json');
    await fs.writeFile(
      p,
      JSON.stringify({
        numStartups: 5,
        mcpServers: { fs: { command: 'npx', args: ['-y', 'x'] } },
        projects: {},
      }),
      'utf8',
    );

    const { resources, issues } = await scanMcpFromClaudeJson(p, { agentId: 'claude' });
    expect(issues).toEqual([]);
    expect(resources).toHaveLength(1);
    expect(resources[0]!.scope).toBe('user');
    expect(resources[0]!.configPath).toBe(p);
    expect(resources[0]!.configPointer).toEqual(['mcpServers']);
    expect(resources[0]!.servers.map((s) => s.name)).toEqual(['fs']);
  });

  it('扫出各项目的 mcpServers（项目级），空数组不产生资源', async () => {
    const p = path.join(tmp, 'claude-projects.json');
    await fs.writeFile(
      p,
      JSON.stringify({
        projects: {
          'D:/proj/a': { mcpServers: { playwright: { command: 'npx' } } },
          'D:/proj/b': { mcpServers: [] },
          'D:/proj/c': {},
        },
      }),
      'utf8',
    );

    const { resources } = await scanMcpFromClaudeJson(p, { agentId: 'claude' });
    expect(resources).toHaveLength(1);
    expect(resources[0]!.scope).toBe('project');
    expect(resources[0]!.projectPath).toBe('D:/proj/a');
    expect(resources[0]!.configPointer).toEqual([
      'projects',
      'D:/proj/a',
      'mcpServers',
    ]);
  });

  it('顶层无 mcpServers 时不产生资源（本机的真实情况）', async () => {
    const p = path.join(tmp, 'claude-empty.json');
    await fs.writeFile(
      p,
      JSON.stringify({ projects: { 'D:/proj/a': { mcpServers: [] } } }),
      'utf8',
    );

    const { resources, issues } = await scanMcpFromClaudeJson(p, { agentId: 'claude' });
    expect(resources).toEqual([]);
    expect(issues).toEqual([]);
  });

  it('JSON 语法错误时记 bad-json issue', async () => {
    const p = path.join(tmp, 'claude-broken.json');
    await fs.writeFile(p, '{ not json', 'utf8');

    const { resources, issues } = await scanMcpFromClaudeJson(p, { agentId: 'claude' });
    expect(resources).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe('bad-json');
  });

  it('文件不存在时静默返回空（不产生 issue）', async () => {
    const { resources, issues } = await scanMcpFromClaudeJson(
      path.join(tmp, 'nope.json'),
      { agentId: 'claude' },
    );
    expect(resources).toEqual([]);
    expect(issues).toEqual([]);
  });
});

describe('scanMcpFromMcpJsonFile', () => {
  it('扫出 .mcp.json 里的 mcpServers，scope 为 project', async () => {
    const proj = path.join(tmp, 'proj');
    await fs.mkdir(proj, { recursive: true });
    const p = path.join(proj, '.mcp.json');
    await fs.writeFile(
      p,
      JSON.stringify({
        mcpServers: { git: { command: 'uvx', args: ['mcp-server-git'] } },
      }),
      'utf8',
    );

    const { resources } = await scanMcpFromMcpJsonFile(p, {
      agentId: 'claude',
      scope: 'project',
      projectPath: proj,
    });
    expect(resources).toHaveLength(1);
    expect(resources[0]!.scope).toBe('project');
    expect(resources[0]!.projectPath).toBe(proj);
    expect(resources[0]!.configPointer).toEqual(['mcpServers']);
  });

  it('空 mcpServers 不产生资源', async () => {
    const p = path.join(tmp, 'empty-mcp.json');
    await fs.writeFile(p, JSON.stringify({ mcpServers: {} }), 'utf8');
    const { resources } = await scanMcpFromMcpJsonFile(p, {
      agentId: 'cursor',
      scope: 'user',
    });
    expect(resources).toEqual([]);
  });
});
