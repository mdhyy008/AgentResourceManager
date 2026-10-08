import type { McpResource, MemoryResource, Resource, SkillResource } from '../../core/types';
import type { FileExpect, WriteRequest } from '../../shared/ipc';

/** 把资源当前的落盘状态转成写入前的预期，主进程拿它做「扫描后被改过」的判定 */
export function expectOf(r: Pick<Resource, 'mtimeMs' | 'contentHash'>): FileExpect {
  return { mtimeMs: r.mtimeMs, contentHash: r.contentHash };
}

export function toggleSkill(r: SkillResource, enabled: boolean): WriteRequest {
  return { kind: 'skill-enabled', skillDir: r.path, expect: expectOf(r), enabled };
}

export function setSkillFrontmatter(
  r: SkillResource,
  frontmatter: Record<string, unknown>,
): WriteRequest {
  return { kind: 'skill-frontmatter', skillDir: r.path, expect: expectOf(r), frontmatter };
}

export function setMemoryBody(r: MemoryResource, body: string): WriteRequest {
  return { kind: 'memory-body', filePath: r.path, expect: expectOf(r), body };
}

export function removeMcpServer(r: McpResource, serverName: string): WriteRequest {
  return {
    kind: 'mcp-remove',
    configPath: r.configPath,
    configPointer: r.configPointer,
    serverName,
    expect: expectOf(r),
  };
}

export function addMcpServer(
  target: { configPath: string; configPointer: string[]; expect: FileExpect | null },
  serverName: string,
  entry: Record<string, unknown>,
): WriteRequest {
  return {
    kind: 'mcp-add',
    configPath: target.configPath,
    configPointer: target.configPointer,
    serverName,
    expect: target.expect,
    entry,
  };
}

// ---- frontmatter 表单 ↔ 对象 ----

export interface FrontmatterRow {
  key: string;
  value: string;
}

/** 表单里每行一个键值；非字符串值用 JSON 展示，方便看清数组/对象 */
export function frontmatterToRows(fm: Record<string, unknown>): FrontmatterRow[] {
  return Object.entries(fm).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

/** 只把看起来像数字/布尔/JSON 的值还原成对应类型，其余一律当字符串 */
function parseScalar(raw: string): unknown {
  const text = raw.trim();
  if (text === '') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+$/.test(text)) return Number(text);
  const first = text[0];
  if ((first === '[' && text.endsWith(']')) || (first === '{' && text.endsWith('}'))) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function rowsToFrontmatter(rows: FrontmatterRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key === '') continue;
    out[key] = parseScalar(row.value);
  }
  return out;
}

// ---- MCP 新增表单 ----

export type McpTransport = 'stdio' | 'http' | 'sse';

export interface McpForm {
  name: string;
  transport: McpTransport;
  command: string;
  /** 一行一个参数，避免「参数里带空格」被拆错 */
  args: string;
  url: string;
  /** 一行一个 KEY=VALUE */
  env: string;
  /** 一行一个 KEY: VALUE */
  headers: string;
}

export const EMPTY_MCP_FORM: McpForm = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  env: '',
  headers: '',
};

export function parseKeyValueLines(text: string, separator: '=' | ':'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const at = line.indexOf(separator);
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key !== '') out[key] = value;
  }
  return out;
}

export function buildMcpEntry(form: McpForm): Record<string, unknown> {
  const args = form.args
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a !== '');
  const env = parseKeyValueLines(form.env, '=');
  const headers = parseKeyValueLines(form.headers, ':');

  if (form.transport === 'stdio') {
    const entry: Record<string, unknown> = { command: form.command.trim() };
    if (args.length > 0) entry.args = args;
    if (Object.keys(env).length > 0) entry.env = env;
    return entry;
  }

  const entry: Record<string, unknown> = { type: form.transport, url: form.url.trim() };
  if (Object.keys(headers).length > 0) entry.headers = headers;
  if (Object.keys(env).length > 0) entry.env = env;
  return entry;
}

/** 表单是否填得能提交了 */
export function mcpFormError(form: McpForm): string | null {
  if (form.name.trim() === '') return 'server 名字不能为空';
  if (form.transport === 'stdio' && form.command.trim() === '') return 'stdio 需要填 command';
  if (form.transport !== 'stdio' && form.url.trim() === '') return `${form.transport} 需要填 URL`;
  return null;
}
