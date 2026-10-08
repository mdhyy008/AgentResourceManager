import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { ResourceType, ScanResult } from '../../core/types';
import { TYPE_LABELS } from '../lib/filter';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

const TYPE_ORDER: ResourceType[] = ['skill', 'mcp', 'memory', 'plugin'];

interface ExportDialogProps {
  open: boolean;
  result: ScanResult | null;
  counts: Record<ResourceType, number>;
  onClose(): void;
  /** 导出成功或失败后通知外层弹提示 */
  onExported(ok: boolean, message: string): void;
}

/**
 * 导出前的确认闸。把「会打包什么」和「有什么风险」摆在明面上，
 * 用户点了「导出」才弹保存框——因为 MCP 的 env/headers 是明文进包的。
 */
export default function ExportDialog({
  open,
  result,
  counts,
  onClose,
  onExported,
}: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<ResourceType>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  // 每次打开都回到默认选择：勾上有内容的类型，并清掉上一次的结果
  const available = useMemo(
    () => TYPE_ORDER.filter((t) => counts[t] > 0),
    [counts],
  );
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(available));
    setBusy(false);
    setError(null);
    setSavedPath(null);
  }, [open, available]);

  const toggle = (type: ResourceType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const run = async () => {
    if (!result || selected.size === 0) return;
    setBusy(true);
    setError(null);
    // 按固定顺序传出，归档结构才可预期
    const types = TYPE_ORDER.filter((t) => selected.has(t));
    try {
      const res = await window.arm.exportPackage({ types, result });
      if (res.ok) {
        setSavedPath(res.path ?? '');
        onExported(true, `已导出 ${types.length} 类资源到 ${res.path ?? ''}`);
      } else if (res.canceled) {
        // 用户自己取消的，不弹提示
      } else {
        setError(res.message ?? '导出失败');
        onExported(false, res.message ?? '导出失败');
      }
    } catch (err) {
      setError((err as Error).message);
      onExported(false, (err as Error).message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>导出资源包</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          选中的资源会打包成一个 zip，根目录放着 manifest.json 记录每项来源，便于日后迁移或排查。
        </Typography>

        <Stack spacing={0.5}>
          {TYPE_ORDER.map((type) => {
            const count = counts[type];
            const empty = count === 0;
            return (
              <FormControlLabel
                key={type}
                disabled={empty}
                control={
                  <Checkbox
                    checked={selected.has(type)}
                    onChange={() => toggle(type)}
                    size="small"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2">{TYPE_LABELS[type]}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={empty ? '无' : count}
                      sx={{ height: 20, minWidth: 28 }}
                    />
                  </Stack>
                }
              />
            );
          })}
        </Stack>

        {selected.has('mcp') && counts.mcp > 0 && (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: '12px' }}>
            MCP 配置里的 env、headers 会原样明文写进压缩包，里面若有密钥，请勿外发。
          </Alert>
        )}
        {selected.has('plugin') && counts.plugin > 0 && (
          <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
            Plugins 一类只导出清单（名称、版本、来源市场），插件本体需要从市场重新安装。
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: '12px' }}>
            {error}
          </Alert>
        )}

        {savedPath !== null && (
          <Alert
            severity="success"
            icon={<CheckCircleOutlinedIcon fontSize="inherit" />}
            sx={{ mt: 2, borderRadius: '12px' }}
          >
            <Typography variant="body2">导出完成：</Typography>
            <Box
              component="span"
              className="arm-selectable"
              sx={{ fontFamily: MONO, fontSize: 12, wordBreak: 'break-all' }}
            >
              {savedPath}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
          已选 {selected.size} 类
        </Typography>
        <Button onClick={onClose} disabled={busy}>
          关闭
        </Button>
        <Button
          variant="contained"
          onClick={() => void run()}
          disabled={busy || selected.size === 0 || result === null}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          导出
        </Button>
      </DialogActions>
    </Dialog>
  );
}
