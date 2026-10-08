import * as path from 'node:path';
import { readTextOrNull } from '../../core/fs-utils';
import { scanMcpFromClaudeJson, scanMcpFromMcpJsonFile } from '../../core/scanners/mcp';
import type { WriteRequest } from '../../shared/ipc';
import { atomicWriteText } from '../atomic';
import { applyShape, detectShape } from './text';
import { failure, type PlanResult } from './types';

type McpRequest = Extract<WriteRequest, { configPath: string }>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 当前子树的内容哈希。刻意复用扫描器本身，而不是在这里手算——
 * 因为 `.claude.json` 的顶层（原始 mcpServers）与项目级（归一化后的 entries）
 * 用的是不同的哈希基准，手算迟早会和扫描结果对不上。
 */
async function currentSubtreeHash(
  configPath: string,
  configPointer: string[],
): Promise<string | null> {
  const isClaudeJson = path.basename(configPath).toLowerCase() === '.claude.json';
  const scanned = isClaudeJson
    ? await scanMcpFromClaudeJson(configPath, { agentId: '' })
    : await scanMcpFromMcpJsonFile(configPath, {
        agentId: '',
        scope: configPointer.length > 1 ? 'project' : 'user',
      });
  const want = configPointer.join('.');
  const found = scanned.resources.find((r) => r.configPointer.join('.') === want);
  return found ? found.contentHash : null;
}

/** 从原文里猜缩进宽度，猜不到就用两空格。 */
function detectIndent(text: string): string {
  const match = text.match(/^([ \t]+)"/m);
  return match ? match[1] : '  ';
}

export async function planMcpWrite(req: McpRequest): Promise<PlanResult> {
  const text = await readTextOrNull(req.configPath);
  if (text === null) return failure(`MCP 配置文件不存在或无法读取：${req.configPath}`);

  if (req.configPointer.length === 0) {
    return failure('配置指针为空，不知道要改文件里的哪一段');
  }

  const shape = detectShape(text);
  const body = text.replace(/^﻿/, '');

  let root: unknown;
  try {
    root = JSON.parse(body) as unknown;
  } catch (err) {
    return failure(`MCP 配置文件不是合法 JSON：${(err as Error).message}`);
  }
  if (!isPlainObject(root)) return failure('MCP 配置文件的顶层不是对象');

  // ---- 走到 configPointer 的父节点 ----
  let parent: Record<string, unknown> = root;
  for (const segment of req.configPointer.slice(0, -1)) {
    const next = parent[segment];
    if (!isPlainObject(next)) {
      return failure(`配置路径不存在：${req.configPointer.join(' › ')}`);
    }
    parent = next;
  }
  const key = req.configPointer[req.configPointer.length - 1];

  // ---- 与磁盘现状比对，发现扫描后被外部改过就中止 ----
  const current = await currentSubtreeHash(req.configPath, req.configPointer);
  if (req.expect === null) {
    if (current !== null) {
      return failure(
        `${req.configPath} 的 mcpServers 已经有内容了（扫描时是空的），为避免覆盖已中止。请先重新扫描。`,
        true,
      );
    }
  } else if (current !== req.expect.contentHash) {
    return failure(
      `${req.configPath} 的 mcpServers 在扫描之后被外部修改过，为避免覆盖别人的改动已中止。请先重新扫描。`,
      true,
    );
  }

  const existingValue = parent[key];
  const existing = isPlainObject(existingValue) ? existingValue : {};

  let nextServers: Record<string, unknown>;
  let summary: string;

  if (req.kind === 'mcp-add') {
    if (req.serverName.trim().length === 0) return failure('server 名字不能为空');
    if (Object.prototype.hasOwnProperty.call(existing, req.serverName)) {
      return failure(`已存在同名 server：${req.serverName}`);
    }
    nextServers = { ...existing, [req.serverName]: req.entry };
    summary = `新增 MCP server：${req.serverName}`;
  } else {
    if (!Object.prototype.hasOwnProperty.call(existing, req.serverName)) {
      return failure(`找不到名为 ${req.serverName} 的 server`);
    }
    nextServers = Object.fromEntries(
      Object.entries(existing).filter(([name]) => name !== req.serverName),
    );
    summary = `删除 MCP server：${req.serverName}`;
  }

  const before = JSON.stringify(existing, null, 2);
  const after = JSON.stringify(nextServers, null, 2);
  if (before === after) return failure('内容没有变化，无需写入');

  const indent = detectIndent(body);
  const trailingNewline = text.endsWith('\n');

  return {
    ok: true,
    plan: {
      kind: req.kind,
      targetPath: req.configPath,
      summary,
      scope: 'subtree',
      before,
      after,
      commit: async () => {
        // 只替换 mcpServers 这一段，文件里其它键（含 projects 里的项目状态）原样保留。
        // mcpServers 本来不存在时，这一步顺带把它建出来。
        parent[key] = nextServers;
        const serialized = JSON.stringify(root, null, indent) + (trailingNewline ? '\n' : '');
        await atomicWriteText(req.configPath, applyShape(serialized, shape));
      },
    },
  };
}
