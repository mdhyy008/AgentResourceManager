import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { WritePreview, WriteRequest } from '../../shared/ipc';
import DiffView from './DiffView';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

/**
 * 写入前的最后一道闸：主进程先 dry-run 出一份 diff 给用户看，
 * 确认后才真正落盘。dry-run 和落盘走的是同一套规划逻辑，所以看到的就是会写出的。
 */
export default function WriteConfirmDialog({
  request,
  onClose,
  onApplied,
}: {
  request: WriteRequest | null;
  onClose(): void;
  onApplied(message: string): void;
}) {
  const [preview, setPreview] = useState<WritePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async (req: WriteRequest) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    const result = await window.arm.previewWrite(req);
    if (result.ok) {
      setPreview(result);
    } else {
      setError(result.message);
      setConflict(result.conflict);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (request) {
      setConflict(false);
      void load(request);
    } else {
      setPreview(null);
      setError(null);
      setConflict(false);
    }
  }, [request, load]);

  const confirm = async () => {
    if (!request) return;
    setApplying(true);
    const result = await window.arm.applyWrite(request);
    setApplying(false);
    if (result.ok) {
      onApplied(result.message);
      onClose();
    } else {
      setError(result.message);
      setConflict(false);
    }
  };

  const fileName = preview ? preview.targetPath.split(/[\\/]/).pop() : '';

  return (
    <Dialog open={request !== null} onClose={applying ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>确认写入</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 220 }}>
        {loading && (
          <Stack sx={{ alignItems: 'center', gap: 1.5, py: 6 }}>
            <CircularProgress size={26} />
            <Typography variant="body2" color="text.secondary">
              正在计算改动…
            </Typography>
          </Stack>
        )}

        {!loading && error && (
          <Alert severity={conflict ? 'warning' : 'error'} sx={{ borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {!loading && preview && (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {preview.summary}
            </Typography>
            <Box sx={{ mt: 0.5, mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{ fontFamily: MONO, color: 'text.secondary', wordBreak: 'break-all' }}
              >
                {preview.targetPath}
              </Typography>
              {preview.scope === 'subtree' && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  只改动文件中的 mcpServers 这一段，其余内容原样保留
                </Typography>
              )}
            </Box>
            {preview.scope === 'fs' ? (
              <Box
                component="pre"
                className="arm-selectable"
                sx={{
                  m: 0,
                  p: 1.5,
                  fontFamily: MONO,
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '12px',
                }}
              >
                {preview.after}
              </Box>
            ) : (
              <DiffView before={preview.before} after={preview.after} />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }} noWrap>
          {preview ? `写入前会自动备份原文件，可在「操作记录」里撤销` : fileName}
        </Typography>
        <Button onClick={onClose} disabled={applying}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={() => void confirm()}
          disabled={!preview || applying}
          startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          写入
        </Button>
      </DialogActions>
    </Dialog>
  );
}
