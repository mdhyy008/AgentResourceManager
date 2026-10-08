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
import type { BatchPlan } from '../lib/batch';

/**
 * 批量写入前的确认：把「会改哪些、会跳过哪些」摊开给用户看，
 * 确认后由调用方串行执行（执行期间这里的按钮锁住并转圈）。
 */
export default function BatchConfirmDialog({
  title,
  open,
  plan,
  running,
  onCancel,
  onConfirm,
}: {
  title: string;
  open: boolean;
  plan: BatchPlan | null;
  running: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const items = plan?.items ?? [];
  const skipped = plan?.skipped ?? [];

  return (
    <Dialog open={open} onClose={running ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 140 }}>
        {items.length === 0 ? (
          <Alert severity="warning" sx={{ borderRadius: '12px' }}>
            选中的项里没有可以执行这个操作的，都是「本来就已是目标状态」或类型不支持。
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              将处理 {items.length} 项
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {items.map((item) => (
                <Typography key={item.id} variant="body2" sx={{ color: 'text.secondary' }}>
                  {item.name}
                </Typography>
              ))}
            </Stack>
          </>
        )}

        {skipped.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              跳过 {skipped.length} 项
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {skipped.map((s) => (
                <Typography key={s.id} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {`${s.name} —— ${s.reason}`}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
          每项写入前都会单独备份，之后可以在「操作记录」里逐条撤销。
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={running}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={running || items.length === 0}
          startIcon={running ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {running ? '执行中…' : '执行'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
