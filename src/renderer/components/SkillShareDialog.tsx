import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { AgentId, SkillResource } from '../../core/types';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

/** 能接收共享的目标：某个 agent 的 skills 目录 */
export interface ShareTarget {
  id: AgentId;
  name: string;
  skillsDir: string;
}

interface SkillShareDialogProps {
  /** 一次要共享的 skill；空数组表示对话框关闭 */
  skills: SkillResource[];
  targets: ShareTarget[];
  onClose(): void;
  /** 由调用方决定发一条还是多条写入请求（批量共享时是多条） */
  onSubmit(target: ShareTarget, mode: 'link' | 'copy'): void;
}

/**
 * 把选中的 skill 共享给另一个 agent。两种方式二选一：
 * - 联接（junction）：在目标目录里建一个指向源目录的链接，改一处两边都变，不占空间。
 * - 复制：把整个目录拷一份，两边从此各自独立。
 */
export default function SkillShareDialog({
  skills,
  targets,
  onClose,
  onSubmit,
}: SkillShareDialogProps) {
  const [mode, setMode] = useState<'link' | 'copy'>('link');
  const [targetId, setTargetId] = useState<string>('');
  const open = skills.length > 0;

  // 每次打开都重置，并默认选中第一个可选目标
  useEffect(() => {
    if (!open) return;
    setMode('link');
    setTargetId(targets[0]?.id ?? '');
  }, [open, targets]);

  const target = targets.find((t) => t.id === targetId) ?? null;

  const submit = () => {
    if (!open || !target) return;
    onSubmit(target, mode);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {skills.length === 1 ? '共享 skill 给其它 agent' : `共享 ${skills.length} 个 skill 给其它 agent`}
      </DialogTitle>
      <DialogContent dividers>
        {skills.length === 1 ? (
          <Typography variant="body2" color="text.secondary">
            把
            <Box component="span" sx={{ fontFamily: MONO, color: 'text.primary' }}>
              {` ${skills[0].name} `}
            </Box>
            放到另一个 agent 的 skills 目录里，让它也能用上。
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              把这些 skill 一起放到另一个 agent 的 skills 目录里：
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {skills.map((s) => (
                <Chip key={s.id} size="small" label={s.name} variant="outlined" sx={{ height: 22 }} />
              ))}
            </Stack>
          </>
        )}

        {targets.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
            没有可共享的目标 agent——要么它们都已经在用了，要么目标位置已被同名 skill 占着，
            要么它们的 skills 目录探测不到。
          </Alert>
        ) : (
          <>
            <Typography variant="overline" sx={{ display: 'block', mt: 2.5, color: 'text.secondary', letterSpacing: 1 }}>
              目标 agent
            </Typography>
            <RadioGroup value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {targets.map((t) => (
                <FormControlLabel
                  key={t.id}
                  value={t.id}
                  control={<Radio size="small" />}
                  sx={{ alignItems: 'flex-start', mt: 0.5 }}
                  label={
                    <Box sx={{ pt: 0.25 }}>
                      <Typography variant="body2">{t.name}</Typography>
                      <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: 'text.secondary', wordBreak: 'break-all' }}>
                        {t.skillsDir}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>

            <Typography variant="overline" sx={{ display: 'block', mt: 2.5, color: 'text.secondary', letterSpacing: 1 }}>
              共享方式
            </Typography>
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as 'link' | 'copy')}>
              <FormControlLabel
                value="link"
                control={<Radio size="small" />}
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">目录联接（推荐）</Typography>
                    <Chip size="small" label="不占空间" variant="outlined" sx={{ height: 20 }} />
                  </Stack>
                }
              />
              <FormControlLabel
                value="copy"
                control={<Radio size="small" />}
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ContentCopyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">复制一份</Typography>
                    <Chip size="small" label="各自独立" variant="outlined" sx={{ height: 20 }} />
                  </Stack>
                }
              />
            </RadioGroup>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
              {mode === 'link'
                ? '在目标目录里建一个指向源目录的联接，源 skill 改动会自动同步，不需要管理员权限。'
                : '把整个目录拷贝过去，两边从此各自独立改动、不再同步。'}
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button variant="contained" onClick={submit} disabled={!target}>
          共享
        </Button>
      </DialogActions>
    </Dialog>
  );
}
