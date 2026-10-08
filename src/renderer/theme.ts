import { createTheme } from '@mui/material/styles';

/**
 * 圆润现代的 Material Design 3 深色主题。
 * 思路：大圆角 + 低饱和的层级底色 + 不用阴影表达层级（改用描边与底色差异），
 * 这是 MD3 深色模式最典型的观感。
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#A8C7FA' },
    secondary: { main: '#D0BCFF' },
    info: { main: '#8FD3FF' },
    success: { main: '#8ED9A8' },
    warning: { main: '#F5C77E' },
    error: { main: '#F2A6A6' },
    background: { default: '#0F1115', paper: '#171A21' },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: { primary: '#E6E8EE', secondary: '#9AA3B2' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
    h6: { fontWeight: 600, letterSpacing: 0.2 },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.7 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // 界面文字（标题、导航、标签、按钮）一律不可选中；只有真正的内容——
        // 路径、文件正文、diff——才允许复制，用 .arm-selectable 显式标出来。
        // 表单控件单独放行，否则输入框里没法划选文字。
        body: { overflow: 'hidden', userSelect: 'none' },
        'input, textarea, [contenteditable="true"], .arm-selectable': { userSelect: 'text' },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: 999,
          border: '3px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(255,255,255,0.24)' },
        '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none', boxShadow: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, fontWeight: 500 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
        sizeSmall: { height: 24 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 10, margin: '0 10px', paddingTop: 8, paddingBottom: 8 },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 20, backgroundImage: 'none' } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 10, fontSize: 12 } },
    },
  },
});
