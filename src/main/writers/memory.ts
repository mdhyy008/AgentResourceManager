import { readTextOrNull, sha256 } from '../../core/fs-utils';
import type { WriteRequest } from '../../shared/ipc';
import { atomicWriteText } from '../atomic';
import { applyShape, detectShape } from './text';
import { failure, type PlanResult } from './types';

type MemoryRequest = Extract<WriteRequest, { kind: 'memory-body' }>;

/**
 * 记忆文件没有 frontmatter，正文就是整个文件，所以直接把新正文写回去。
 */
export async function planMemoryWrite(req: MemoryRequest): Promise<PlanResult> {
  const text = await readTextOrNull(req.filePath);
  if (text === null) return failure(`记忆文件不存在或无法读取：${req.filePath}`);

  const actual = sha256(text);
  if (actual !== req.expect.contentHash) {
    return failure(
      `${req.filePath} 在扫描之后被外部修改过，为避免覆盖改动已中止。请先重新扫描。`,
      true,
    );
  }

  // 编辑框里拿到的是浏览器归一化过的 LF，写回时按原文件的换行还原
  const after = applyShape(req.body, detectShape(text));
  if (after === text) return failure('内容没有变化，无需写入');

  return {
    ok: true,
    plan: {
      kind: 'memory-body',
      targetPath: req.filePath,
      summary: `编辑记忆：${req.filePath.split(/[\\/]/).pop() ?? req.filePath}`,
      scope: 'file',
      before: text,
      after,
      commit: () => atomicWriteText(req.filePath, after),
    },
  };
}
