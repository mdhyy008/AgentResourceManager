const BOM = '﻿';

export interface TextShape {
  bom: boolean;
  eol: '\n' | '\r\n';
}

/**
 * 记下原文件用的是 CRLF 还是 LF、有没有 BOM。
 * 解析器为了好处理会把这些归一化掉，但写回时必须还原——
 * 否则一次「加一行」的编辑会让整个文件的每一行都变成 diff。
 */
export function detectShape(text: string): TextShape {
  return {
    bom: text.startsWith(BOM),
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  };
}

/** 先归一到 LF（并去掉 BOM），再按目标形态还原 */
export function applyShape(text: string, shape: TextShape): string {
  const lf = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const withEol = shape.eol === '\n' ? lf : lf.replace(/\n/g, '\r\n');
  return shape.bom ? BOM + withEol : withEol;
}
