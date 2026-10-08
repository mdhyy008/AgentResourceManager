import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { MemoryResource, SkillResource } from '../../core/types';
import type { FileExpect, WriteRequest } from '../../shared/ipc';
import {
  addMcpServer,
  buildMcpEntry,
  EMPTY_MCP_FORM,
  frontmatterToRows,
  mcpFormError,
  rowsToFrontmatter,
  setMemoryBody,
  setSkillFrontmatter,
  type FrontmatterRow,
  type McpForm,
  type McpTransport,
} from '../lib/write';

export interface McpAddTarget {
  configPath: string;
  configPointer: string[];
  /** null 表示该 mcpServers 尚不存在，本次是从零新建 */
  expect: FileExpect | null;
  label: string;
}

export type EditTarget =
  | { mode: 'skill-frontmatter'; resource: SkillResource }
  | { mode: 'memory-body'; resource: MemoryResource }
  | { mode: 'mcp-add'; target: McpAddTarget };

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

function titleOf(target: EditTarget): string {
  switch (target.mode) {
    case 'skill-frontmatter':
      return `编辑 frontmatter：${target.resource.name}`;
    case 'memory-body':
      return `编辑记忆正文：${target.resource.name}`;
    case 'mcp-add':
      return `新增 MCP server · ${target.target.label}`;
  }
}

export default function EditDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: EditTarget | null;
  onClose(): void;
  onSubmit(request: WriteRequest): void;
}) {
  const [rows, setRows] = useState<FrontmatterRow[]>([]);
  const [body, setBody] = useState('');
  const [form, setForm] = useState<McpForm>(EMPTY_MCP_FORM);

  // 每次打开都按当前资源重置表单，避免残留上一次的输入
  useEffect(() => {
    if (!target) return;
    if (target.mode === 'skill-frontmatter') {
      setRows(frontmatterToRows(target.resource.frontmatter));
    } else if (target.mode === 'memory-body') {
      setBody(target.resource.body);
    } else {
      setForm(EMPTY_MCP_FORM);
    }
  }, [target]);

  const mcpError = useMemo(
    () => (target?.mode === 'mcp-add' ? mcpFormError(form) : null),
    [target, form],
  );

  const submit = () => {
    if (!target) return;
    if (target.mode === 'skill-frontmatter') {
      onSubmit(setSkillFrontmatter(target.resource, rowsToFrontmatter(rows)));
    } else if (target.mode === 'memory-body') {
      onSubmit(setMemoryBody(target.resource, body));
    } else if (!mcpError) {
      onSubmit(addMcpServer(target.target, form.name.trim(), buildMcpEntry(form)));
    }
  };

  return (
    <Dialog open={target !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{target ? titleOf(target) : ''}</DialogTitle>
      <DialogContent dividers>
        {target?.mode === 'skill-frontmatter' && (
          <>
            <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
              这里编辑的是 SKILL.md 的 frontmatter 部分，正文不会被改动。
              值支持数字、true/false 和 JSON 数组/对象。
            </Alert>
            <Stack spacing={1}>
              {rows.map((row, index) => (
                <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    value={row.key}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
                    }
                    placeholder="键"
                    sx={{ width: 200, flexShrink: 0, '& input': { fontFamily: MONO, fontSize: 13 } }}
                  />
                  <TextField
                    value={row.value}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
                    }
                    placeholder="值"
                    fullWidth
                    sx={{ '& input': { fontFamily: MONO, fontSize: 13 } }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    aria-label="删除这一项"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button
              startIcon={<AddIcon />}
              sx={{ mt: 1.5 }}
              onClick={() => setRows([...rows, { key: '', value: '' }])}
            >
              添加一项
            </Button>
          </>
        )}

        {target?.mode === 'memory-body' && (
          <>
            <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
              这里编辑的是整份文件的正文原样写回，frontmatter 之外的格式不会被重排。
            </Alert>
            <TextField
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              minRows={16}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 13 } } }}
            />
          </>
        )}

        {target?.mode === 'mcp-add' && (
          <Stack spacing={2}>
            <Typography
              variant="caption"
              sx={{ fontFamily: MONO, color: 'text.secondary', wordBreak: 'break-all' }}
            >
              {target.target.configPath} · {target.target.configPointer.join('.')}
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="server 名字"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                sx={{ width: 220 }}
              />
              <TextField
                select
                label="传输方式"
                value={form.transport}
                onChange={(e) => setForm({ ...form, transport: e.target.value as McpTransport })}
                sx={{ width: 160 }}
              >
                <MenuItem value="stdio">stdio</MenuItem>
                <MenuItem value="http">http</MenuItem>
                <MenuItem value="sse">sse</MenuItem>
              </TextField>
            </Stack>

            {form.transport === 'stdio' ? (
              <>
                <TextField
                  label="command"
                  value={form.command}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="npx"
                  sx={{ '& input': { fontFamily: MONO, fontSize: 13 } }}
                />
                <TextField
                  label="args（一行一个参数）"
                  value={form.args}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                  multiline
                  minRows={3}
                  slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 13 } } }}
                />
              </>
            ) : (
              <>
                <TextField
                  label="URL"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/mcp"
                  sx={{ '& input': { fontFamily: MONO, fontSize: 13 } }}
                />
                <TextField
                  label="headers（一行一个 KEY: VALUE）"
                  value={form.headers}
                  onChange={(e) => setForm({ ...form, headers: e.target.value })}
                  multiline
                  minRows={2}
                  slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 13 } } }}
                />
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                  请求头里若含密钥会以明文写入配置文件。
                </Alert>
              </>
            )}

            <TextField
              label="env（一行一个 KEY=VALUE）"
              value={form.env}
              onChange={(e) => setForm({ ...form, env: e.target.value })}
              multiline
              minRows={2}
              slotProps={{ input: { sx: { fontFamily: MONO, fontSize: 13 } } }}
            />

            {mcpError && (
              <Box>
                <Typography variant="caption" color="error">
                  {mcpError}
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={target?.mode === 'mcp-add' && mcpError !== null}
        >
          预览改动
        </Button>
      </DialogActions>
    </Dialog>
  );
}
