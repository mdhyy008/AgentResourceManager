import * as path from 'node:path';
import {
  FrontmatterError,
  parseFrontmatter,
  serializeFrontmatter,
} from '../../core/frontmatter';
import { readTextOrNull, sha256 } from '../../core/fs-utils';
import type { WriteRequest } from '../../shared/ipc';
import { atomicWriteText } from '../atomic';
import { applyShape, detectShape } from './text';
import { failure, type PlanResult } from './types';

/** Claude Code 官方的 skill 禁用开关 */
export const DISABLE_KEY = 'disable-model-invocation';

export function skillManifestPath(skillDir: string): string {
  return path.join(skillDir, 'SKILL.md');
}

type SkillRequest = Extract<WriteRequest, { skillDir: string }>;

export async function planSkillWrite(req: SkillRequest): Promise<PlanResult> {
  const manifest = skillManifestPath(req.skillDir);
  const text = await readTextOrNull(manifest);
  if (text === null) return failure(`SKILL.md 不存在或无法读取：${manifest}`);

  const actual = sha256(text);
  if (actual !== req.expect.contentHash) {
    return failure(
      `SKILL.md 在扫描之后被外部修改过，为避免覆盖别人的改动，已中止。` +
        `期望哈希 ${req.expect.contentHash.slice(0, 8)}，实际 ${actual.slice(0, 8)}。请先重新扫描。`,
      true,
    );
  }

  let parsed;
  try {
    parsed = parseFrontmatter(text);
  } catch (err) {
    return failure(
      err instanceof FrontmatterError ? err.message : (err as Error).message,
    );
  }

  const name = path.basename(req.skillDir);
  // 解析会把换行归一成 LF、去掉 BOM，写回时按原样还原
  const shape = detectShape(text);

  if (req.kind === 'skill-enabled') {
    const data: Record<string, unknown> = { ...parsed.data };
    if (req.enabled) delete data[DISABLE_KEY];
    else data[DISABLE_KEY] = true;

    const after = applyShape(serializeFrontmatter(data, parsed.body), shape);
    if (after === text) return failure('内容没有变化，无需写入');

    return {
      ok: true,
      plan: {
        kind: 'skill-enabled',
        targetPath: manifest,
        summary: req.enabled ? `启用 skill：${name}` : `禁用 skill：${name}`,
        scope: 'file',
        before: text,
        after,
        commit: () => atomicWriteText(manifest, after),
      },
    };
  }

  const after = applyShape(serializeFrontmatter(req.frontmatter, parsed.body), shape);
  if (after === text) return failure('内容没有变化，无需写入');

  return {
    ok: true,
    plan: {
      kind: 'skill-frontmatter',
      targetPath: manifest,
      summary: `修改 frontmatter：${name}`,
      scope: 'file',
      before: text,
      after,
      commit: () => atomicWriteText(manifest, after),
    },
  };
}
