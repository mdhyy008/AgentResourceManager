import { app, BrowserWindow, dialog, ipcMain, protocol, session } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readConfig, writeConfig } from './config';
import { dataDir, loadCachedScan, runFullScan } from './scan-service';
import { IPC } from '../shared/ipc';
import type { AppConfig } from '../shared/ipc';

/** electron-vite 在 dev 模式下注入；打包构建时为空 */
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(DEV_SERVER_URL);

/**
 * 内容安全策略。刻意不含 'unsafe-eval'。
 * dev 模式下放宽到 'unsafe-inline'：Vite 的 react-refresh 前导脚本是内联的，
 * emotion（MUI 样式引擎）也在运行时注入 <style>。生产构建应去掉这两处放宽。
 */
function contentSecurityPolicy(): string {
  const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
  const scriptSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
  const connectSrc = isDev ? "'self' http://localhost:* ws://localhost:*" : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * 用自定义 app:// 协议提供渲染产物。
 * 不用 loadFile/file://：file:// 的 origin 是不透明的 null，
 * 加载 ES module 会被 CORS 挡掉。
 */
function registerAppProtocol(): void {
  const rendererRoot = path.join(__dirname, '../renderer');
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = path.normalize(path.join(rendererRoot, rel));
    if (!target.startsWith(path.normalize(rendererRoot) + path.sep) && target !== rendererRoot) {
      return new Response('forbidden', { status: 403 });
    }
    try {
      const data = await fs.readFile(target);
      const mime = MIME_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': mime } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

function installCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    });
  });
}

/**
 * 无人值守自检：设置 ARM_SELFCHECK=<png 路径> 后，页面加载完会等一小会儿，
 * 打印一份 DOM 摘要并截图存盘。用于在没有人工点击的情况下确认界面确实渲染成功。
 */
function attachSelfCheck(win: BrowserWindow): void {
  const target = process.env.ARM_SELFCHECK;
  if (!target) return;
  const delay = Number(process.env.ARM_SELFCHECK_DELAY ?? 6000);

  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        try {
          const summary = await win.webContents.executeJavaScript(
            `JSON.stringify({
              topbar: (document.querySelector('header') || {}).innerText || '',
              nav: Array.from(document.querySelectorAll('nav .MuiListItemText-primary')).map((e) => e.textContent),
              listCount: document.querySelectorAll('main .MuiListItemButton-root, .MuiList-root .MuiListItemButton-root').length,
              text: (document.body.innerText || '').slice(0, 600)
            })`,
          );
          console.log(`[selfcheck] ${summary}`);
          const image = await win.webContents.capturePage();
          const out = path.resolve(process.cwd(), target);
          await fs.writeFile(out, image.toPNG());
          console.log(`[selfcheck] 截图已保存：${out}`);
        } catch (err) {
          console.error('[selfcheck] 失败：', err);
        }
      })();
    }, delay);
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#0F1115',
    title: 'Agent 资源管理器',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  attachSelfCheck(win);

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadURL('app://bundle/index.html');
  }
}

function registerIpc(): void {
  const dir = dataDir();

  ipcMain.handle(IPC.scanCached, () => loadCachedScan(dir));

  ipcMain.handle(IPC.scanRun, async () => {
    const config = await readConfig(dir);
    return runFullScan(dir, config);
  });

  ipcMain.handle(IPC.configGet, () => readConfig(dir));

  ipcMain.handle(IPC.configSave, async (_event, incoming: AppConfig) => {
    await writeConfig(dir, incoming);
    return readConfig(dir);
  });

  ipcMain.handle(IPC.dialogPickDirectory, async () => {
    const picked = await dialog.showOpenDialog({
      title: '选择 agent 根目录',
      properties: ['openDirectory'],
    });
    return picked.canceled || picked.filePaths.length === 0 ? null : picked.filePaths[0];
  });
}

// 必须在 app ready 之前登记自定义协议的特权
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

void app.whenReady().then(() => {
  installCsp();
  registerAppProtocol();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
