import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

export interface McpCandidate {
  path: string;
  /** 这个配置文件属于哪个 agent */
  label: string;
}

/**
 * 本机探测到的 MCP 配置文件可能不止一个，新增 server 前先让用户挑一个写进去。
 */
export default function McpTargetPickerDialog({
  open,
  candidates,
  onPick,
  onClose,
}: {
  open: boolean;
  candidates: McpCandidate[];
  onPick(candidate: McpCandidate): void;
  onClose(): void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>选择要写入的 MCP 配置文件</DialogTitle>
      <DialogContent dividers>
        <List disablePadding>
          {candidates.map((candidate) => (
            <ListItemButton key={candidate.path} onClick={() => onPick(candidate)}>
              <ListItemText
                primary={candidate.label}
                secondary={candidate.path}
                slotProps={{
                  primary: { sx: { fontSize: 14, fontWeight: 600 } },
                  secondary: { sx: { fontFamily: MONO, fontSize: 12, wordBreak: 'break-all' } },
                }}
              />
            </ListItemButton>
          ))}
        </List>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
          选中的文件里，mcpServers 会被新增或更新，文件其余内容原样保留。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>取消</Button>
      </DialogActions>
    </Dialog>
  );
}
