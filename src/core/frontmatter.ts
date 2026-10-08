import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
  /** 原始 frontmatter 文本，不含 --- 分隔符；无 frontmatter 时为空串 */
  raw: string;
}

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterError';
  }
}

const DELIMITER = /^---[ \t]*$/;

/**
 * 只认文件开头第一行的 `---` 作为 frontmatter 起点。
 * 之所以不用 gray-matter：它的错误信息对「缺少结束分隔符」这类问题不友好，
 * 而我们需要把具体原因展示到界面的「异常」分类里。
 */
export function parseFrontmatter(text: string): ParsedFrontmatter {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '---') {
    return { data: {}, body: normalized, raw: '' };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new FrontmatterError('frontmatter 缺少结束的 --- 分隔符');
  }

  const raw = lines.slice(1, end).join('\n');
  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^\n+/, '');

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new FrontmatterError(`frontmatter YAML 语法错误：${(err as Error).message}`);
  }

  if (parsed === null || parsed === undefined) parsed = {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FrontmatterError('frontmatter 顶层必须是键值映射');
  }

  return { data: parsed as Record<string, unknown>, body, raw };
}

export function serializeFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  const yamlText = stringifyYaml(data, { lineWidth: 0 }).replace(/\n+$/, '');
  return `---\n${yamlText}\n---\n\n${body.replace(/^\n+/, '')}`;
}
