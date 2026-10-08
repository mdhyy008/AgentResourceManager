import { describe, expect, it } from 'vitest';
import {
  FrontmatterError,
  parseFrontmatter,
  serializeFrontmatter,
} from '../src/core/frontmatter';

describe('parseFrontmatter', () => {
  it('解析标准的 frontmatter + 正文', () => {
    const text = [
      '---',
      'name: demo',
      'description: 示例技能',
      '---',
      '',
      '# 标题',
      '正文',
    ].join('\n');
    const fm = parseFrontmatter(text);
    expect(fm.data).toEqual({ name: 'demo', description: '示例技能' });
    expect(fm.body).toBe('# 标题\n正文');
  });

  it('没有 frontmatter 时 data 为空、body 为全文', () => {
    const fm = parseFrontmatter('# 只有正文');
    expect(fm.data).toEqual({});
    expect(fm.body).toBe('# 只有正文');
  });

  it('支持 disable-model-invocation 布尔字段', () => {
    const text = [
      '---',
      'name: grill-me',
      'disable-model-invocation: true',
      '---',
      '',
      'x',
    ].join('\n');
    expect(parseFrontmatter(text).data['disable-model-invocation']).toBe(true);
  });

  it('去除 BOM 并把 CRLF 归一为 LF', () => {
    const text = '﻿---\r\nname: demo\r\n---\r\n\r\n正文';
    const fm = parseFrontmatter(text);
    expect(fm.data.name).toBe('demo');
    expect(fm.body).toBe('正文');
  });

  it('frontmatter 缺少结束分隔符时抛 FrontmatterError', () => {
    expect(() => parseFrontmatter('---\nname: demo\n正文')).toThrow(FrontmatterError);
  });

  it('frontmatter YAML 语法错误时抛 FrontmatterError', () => {
    expect(() => parseFrontmatter('---\nname: [unclosed\n---\n正文')).toThrow(
      FrontmatterError,
    );
  });

  it('frontmatter 顶层不是映射时抛 FrontmatterError', () => {
    expect(() => parseFrontmatter('---\n- a\n- b\n---\n正文')).toThrow(FrontmatterError);
  });
});

describe('serializeFrontmatter', () => {
  it('能往返序列化', () => {
    const data = { name: 'demo', description: '示例技能' };
    const out = serializeFrontmatter(data, '# 标题\n正文');
    const back = parseFrontmatter(out);
    expect(back.data).toEqual(data);
    expect(back.body).toBe('# 标题\n正文');
  });

  it('保留布尔字段并允许写回 false', () => {
    const out = serializeFrontmatter(
      { name: 'x', 'disable-model-invocation': false },
      'body',
    );
    expect(parseFrontmatter(out).data['disable-model-invocation']).toBe(false);
  });
});
