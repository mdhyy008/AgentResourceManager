import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { AppConfig, CustomAgentConfig } from '../../shared/ipc';

/** 内置 agent 的 id，自定义 id 不能与之重复 */
const BUILT_IN_IDS = [
  'claude',
  'cursor',
  'lingma',
  'agents',
  'codex',
  'gemini',
  'windsurf',
  'trae',
  'continue',
];

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lastSegment(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

interface CustomAgentDialogProps {
  open: boolean;
  onClose(): void;
  config: AppConfig;
  onConfigChange(config: AppConfig): void;
}

export default function CustomAgentDialog({
  open,
  onClose,
  config,
  onConfigChange,
}: CustomAgentDialogProps) {
  const [name, setName] = useState('');
  const [root, setRoot] = useState('');
  const [skillsSubdir, setSkillsSubdir] = useState('skills');
  const [mcpFiles, setMcpFiles] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setRoot('');
    setSkillsSubdir('skills');
    setMcpFiles('');
    setError(null);
  };

  const persist = async (next: CustomAgentConfig[]) => {
    setBusy(true);
    try {
      const saved = await window.arm.saveConfig({ customAgents: next });
      onConfigChange(saved);
      return saved;
    } finally {
      setBusy(false);
    }
  };

  const pickRoot = async () => {
    const picked = await window.arm.pickDirectory();
    if (picked) setRoot(picked);
  };

  const addAgent = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('请填写展示名');
      return;
    }
    if (!root.trim()) {
      setError('请选择根目录');
      return;
    }
    const id = slugify(trimmedName) || slugify(lastSegment(root));
    if (!id) {
      setError('无法从名称推导出 id，请把展示名改成含字母或数字的形式');
      return;
    }
    const taken = [...BUILT_IN_IDS, ...config.customAgents.map((a) => a.id)];
    if (taken.includes(id)) {
      setError(`id "${id}" 已被占用，请换一个展示名`);
      return;
    }
    const entry: CustomAgentConfig = {
      id,
      name: trimmedName,
      root: root.trim(),
      skillsSubdir: skillsSubdir.trim(),
      mcpFiles: mcpFiles
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    await persist([...config.customAgents, entry]);
    reset();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>自定义 agent 路径</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          内置列表之外的 agent，可以手工登记一个根目录，并指定它的各资源位置。
        </Typography>

        {config.customAgents.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {config.customAgents.map((a) => (
              <Stack
                key={a.id}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {a.name} <Typography component="span" variant="caption" color="text.secondary">({a.id})</Typography>
                  </Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 11.5, wordBreak: 'break-all', color: 'text.secondary' }}>
                    {a.root}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  disabled={busy}
                  onClick={() => void persist(config.customAgents.filter((x) => x.id !== a.id))}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          <TextField
            label="展示名"
            placeholder="例如 My Agent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label="根目录"
              placeholder="C:\\Users\\me\\.myagent"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              fullWidth
            />
            <Button onClick={() => void pickRoot()} startIcon={<FolderOpenIcon />} variant="outlined" sx={{ flexShrink: 0 }}>
              选择
            </Button>
          </Stack>
          <TextField
            label="skills 子目录（相对根目录，留空表示没有）"
            value={skillsSubdir}
            onChange={(e) => setSkillsSubdir(e.target.value)}
            fullWidth
          />
          <TextField
            label="MCP 配置文件（相对根目录，多个用逗号分隔）"
            placeholder="mcp.json, config.json"
            value={mcpFiles}
            onChange={(e) => setMcpFiles(e.target.value)}
            fullWidth
          />
          {error && <Alert severity="warning" sx={{ borderRadius: 3 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          关闭
        </Button>
        <Button onClick={() => void addAgent()} variant="contained" disabled={busy}>
          添加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
