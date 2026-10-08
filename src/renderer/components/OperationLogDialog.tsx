import UndoIcon from '@mui/icons-material/Undo';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { OperationRecord } from '../../shared/ipc';
import { formatBeijing } from '../../shared/time';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

const KIND_LABELS: Record<OperationRecord['kind'], string> = {
  'skill-enabled': '启用/禁用',
  'skill-frontmatter': 'frontmatter',
  'skill-share': '共享 skill',
  'memory-body': '记忆正文',
  'mcp-add': 'MCP 新增',
  'mcp-remove': 'MCP 删除',
};

function formatTime(ms: number): string {
  return formatBeijing(ms, true);
}

/**
 * 每次写入都会在这里留一条记录，并附上写入前的备份副本。
 * 撤销就是把备份搬回去；原本不存在的文件，撤销就是删掉。
 */
export default function OperationLogDialog({
  open,
  onClose,
  onUndone,
}: {
  open: boolean;
  onClose(): void;
  onUndone(message: string): void;
}) {
  const [ops, setOps] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOps(await window.arm.listOperations());
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const undo = async (id: string) => {
    setBusyId(id);
    const result = await window.arm.undoOperation(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onUndone(result.message);
    await load();
  };

  const sorted = [...ops].sort((a, b) => b.at - a.at);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>操作记录</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 200 }}>
        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
            {error}
          </Typography>
        )}
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : sorted.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              还没有任何写入操作。
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {sorted.map((op) => (
              <Box
                key={op.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '12px',
                  px: 2,
                  py: 1.5,
                  opacity: op.undone ? 0.55 : 1,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip size="small" label={KIND_LABELS[op.kind]} variant="outlined" sx={{ height: 22 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                    {op.summary}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatTime(op.at)}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  className="arm-selectable"
                  sx={{ display: 'block', mt: 0.75, fontFamily: MONO, color: 'text.secondary', wordBreak: 'break-all' }}
                >
                  {op.targetPath}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                    {op.backupPath === null ? '写入前文件不存在（撤销即删除）' : '已备份写入前的内容'}
                  </Typography>
                  {op.undone ? (
                    <Chip size="small" label="已撤销" variant="outlined" sx={{ height: 22 }} />
                  ) : (
                    <Button
                      size="small"
                      startIcon={
                        busyId === op.id ? <CircularProgress size={14} color="inherit" /> : <UndoIcon />
                      }
                      disabled={busyId !== null}
                      onClick={() => void undo(op.id)}
                    >
                      撤销
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
        <Button variant="contained" onClick={onClose}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
