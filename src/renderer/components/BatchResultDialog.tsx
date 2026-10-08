import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { BatchSummary } from '../lib/batch';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

/**
 * 批量执行完的汇报。成功的只列名字，失败的把原因带出来——
 * 批量操作最容易让人心里没底的就是「到底哪几个没成」。
 */
export default function BatchResultDialog({
  summary,
  onClose,
}: {
  summary: BatchSummary | null;
  onClose(): void;
}) {
  const failed = summary?.outcomes.filter((o) => !o.ok) ?? [];
  const succeeded = summary?.outcomes.filter((o) => o.ok) ?? [];
  const skipped = summary?.skipped ?? [];

  const severity = (summary?.failed ?? 0) > 0 ? 'warning' : 'success';

  return (
    <Dialog open={summary !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>批量操作结果</DialogTitle>
      <DialogContent dividers>
        {summary && (
          <>
            <Alert severity={severity} sx={{ borderRadius: '12px' }}>
              {`成功 ${summary.ok} 项，失败 ${summary.failed} 项`}
              {skipped.length > 0 ? `，跳过 ${skipped.length} 项` : ''}
            </Alert>

            {failed.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                  失败
                </Typography>
                <Stack spacing={1} sx={{ mt: 0.75 }}>
                  {failed.map((o) => (
                    <Box
                      key={o.id}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: '10px', px: 1.5, py: 1 }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <BlockOutlinedIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {o.name}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, color: 'text.secondary', wordBreak: 'break-all' }}
                      >
                        {o.message}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {succeeded.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                  成功
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                  {succeeded.map((o) => (
                    <Stack key={o.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {o.name}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {skipped.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                  跳过
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                  {skipped.map((s) => (
                    <Typography
                      key={s.id}
                      variant="caption"
                      sx={{ display: 'block', fontFamily: MONO, color: 'text.secondary' }}
                    >
                      {`${s.name} —— ${s.reason}`}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onClose}>
          知道了
        </Button>
      </DialogActions>
    </Dialog>
  );
}
