import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { statOrNull } from '../../core/fs-utils';
import type { WriteRequest } from '../../shared/ipc';
import { failure, type PlanResult } from './types';

type ShareRequest = Extract<WriteRequest, { kind: 'skill-share' }>;

/** 复制时跳过的目录：技能包用不到，还会把目标目录撑得很大 */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', '__pycache__', '.idea', '.vscode']);

/**
 * 把一个 skill 共享给另一个 agent：在目标 agent 的 skills 目录下
 * 造一个指向源目录的联接（junction），或者整目录复制过去。
 *
 * 这是「只新建」的操作——目标位置必须还不存在，否则拒绝。用 lstat 判断，
 * 这样目标即使是个断链也会挡住，不会踩到别人留下的东西。
 */
export async function planSkillShare(req: ShareRequest): Promise<PlanResult> {
  const source = await statOrNull(req.sourceDir);
  if (!source?.isDirectory()) {
    return failure(`源 skill 目录不存在：${req.sourceDir}`);
  }

  const name = path.basename(req.sourceDir);
  if (!name || name === '.' || name === '..') {
    return failure(`无法从源路径推导出 skill 名字：${req.sourceDir}`);
  }

  const targetDir = await statOrNull(req.targetSkillsDir);
  if (targetDir !== null && !targetDir.isDirectory()) {
    return failure(`目标的 skills 路径不是目录：${req.targetSkillsDir}`);
  }

  const targetPath = path.join(req.targetSkillsDir, name);
  if ((await statOrNull(targetPath)) !== null) {
    return failure(`目标位置已存在同名项，为免覆盖已中止：${targetPath}`);
  }

  const modeLabel = req.mode === 'link' ? '目录联接' : '整目录复制';
  const preview =
    req.mode === 'link'
      ? `新建目录联接（junction）：\n${targetPath}\n        → ${req.sourceDir}\n\n源 skill 改动会自动同步，不占额外空间。`
      : `复制整个目录：\n${req.sourceDir}\n        → ${targetPath}\n\n复制后两边各自独立改动，不再同步。已跳过 .git / node_modules 等目录。`;

  return {
    ok: true,
    plan: {
      kind: 'skill-share',
      targetPath,
      summary: `把 skill「${name}」${modeLabel}过去`,
      scope: 'fs',
      before: '',
      after: preview,
      commit: async () => {
        // 规划后到落盘之间目标可能被别人占了，落盘前再确认一次
        if ((await statOrNull(targetPath)) !== null) {
          throw new Error(`目标位置已被占用：${targetPath}`);
        }
        if (targetDir === null) await fs.mkdir(req.targetSkillsDir, { recursive: true });

        if (req.mode === 'link') {
          // junction 不需要管理员权限（符号链接才需要），且指向绝对路径即可
          await fs.symlink(req.sourceDir, targetPath, 'junction');
        } else {
          await fs.cp(req.sourceDir, targetPath, {
            recursive: true,
            filter: (src) => src === req.sourceDir || !SKIP_DIRS.has(path.basename(src)),
          });
        }
      },
    },
  };
}
