import { describe, expect, it } from 'vitest';
import {
  buildMcpEntry,
  frontmatterToRows,
  mcpFormError,
  parseKeyValueLines,
  rowsToFrontmatter,
  type McpForm,
} from '../src/renderer/lib/write';

describe('frontmatter 表单互转', () => {
  it('字符串原样，数组与对象走 JSON', () => {
    const rows = frontmatterToRows({ name: 'demo', tools: ['Read', 'Write'] });
    expect(rows).toEqual([
      { key: 'name', value: 'demo' },
      { key: 'tools', value: '["Read","Write"]' },
    ]);
  });

  it('回转时会还原数字、布尔与 JSON', () => {
    const fm = rowsToFrontmatter([
      { key: 'name', value: 'demo' },
      { key: 'priority', value: '3' },
      { key: 'enabled', value: 'true' },
      { key: 'tools', value: '["Read"]' },
      { key: 'note', value: '1 和 2' },
    ]);
    expect(fm).toEqual({
      name: 'demo',
      priority: 3,
      enabled: true,
      tools: ['Read'],
      note: '1 和 2',
    });
  });

  it('忽略空键与去掉键两侧空白', () => {
    const fm = rowsToFrontmatter([
      { key: '  ', value: 'x' },
      { key: ' name ', value: ' demo ' },
    ]);
    expect(fm).toEqual({ name: ' demo ' });
  });
});

describe('parseKeyValueLines', () => {
  it('按第一个分隔符切开，忽略空行与注释', () => {
    expect(
      parseKeyValueLines('# 注释\n\nA=1\nB=x=y\nC\n', '='),
    ).toEqual({ A: '1', B: 'x=y' });
  });

  it('冒号分隔时不会把 URL 里的 https: 当成键', () => {
    expect(parseKeyValueLines('Authorization: Bearer abc:def', ':')).toEqual({
      Authorization: 'Bearer abc:def',
    });
  });
});

describe('buildMcpEntry', () => {
  const base: McpForm = {
    name: 'ctx7',
    transport: 'stdio',
    command: 'npx',
    args: '-y\n@upstash/context7-mcp',
    url: '',
    env: 'API_KEY=abc',
    headers: '',
  };

  it('stdio 生成 command/args/env', () => {
    expect(buildMcpEntry(base)).toEqual({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: { API_KEY: 'abc' },
    });
  });

  it('http 生成 type/url/headers', () => {
    expect(
      buildMcpEntry({ ...base, transport: 'http', url: 'https://x/mcp', headers: 'X-A: 1' }),
    ).toEqual({
      type: 'http',
      url: 'https://x/mcp',
      headers: { 'X-A': '1' },
      env: { API_KEY: 'abc' },
    });
  });

  it('空的可选字段不会写进结果', () => {
    expect(buildMcpEntry({ ...base, args: '', env: '' })).toEqual({ command: 'npx' });
  });
});

describe('mcpFormError', () => {
  it('名字为空报错', () => {
    expect(mcpFormError({ ...({} as McpForm), name: '', transport: 'stdio', command: 'npx' } as McpForm)).toBeTruthy();
  });

  it('stdio 缺 command 报错', () => {
    expect(mcpFormError({ name: 'a', transport: 'stdio', command: '  ' } as McpForm)).toContain('command');
  });

  it('http 缺 URL 报错', () => {
    expect(mcpFormError({ name: 'a', transport: 'http', url: '' } as McpForm)).toContain('URL');
  });

  it('填全了就没错误', () => {
    expect(mcpFormError({ name: 'a', transport: 'http', url: 'https://x' } as McpForm)).toBeNull();
  });
});
