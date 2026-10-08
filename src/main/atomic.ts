import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * 原子写文本：先写同目录下的临时文件再 rename 覆盖。
 * 同一文件系统内 rename 是原子的，所以读者要么看到旧内容、要么看到新内容，
 * 不会读到写了一半的文件。
 */
export async function atomicWriteText(target: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.arm-tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
