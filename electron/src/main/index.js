/**
 * Electron 主进程入口
 * Ubuntu 工具箱桌面版
 */
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

// 子模块
const { startFlask, stopFlask, getFlaskUrl } = require('./flask-server');
const { registerIpcHandlers } = require('./ipc-handlers');

let mainWindow = null;

// Flask 服务端口
const FLASK_PORT = process.env.FLASK_PORT || 38457;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ubuntu 工具箱',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // 开发模式：打开 DevTools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Main] Window ready');
  });

  // 加载 Flask
  const flaskUrl = getFlaskUrl();
  mainWindow.loadURL(flaskUrl).catch(err => {
    console.error('[Main] Failed to load:', err.message);
  });

  // 注册 IPC（把 mainWindow 传进去用于实时推送）
  registerIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.openDevTools() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Ubuntu 工具箱',
              message: 'Ubuntu 工具箱 v1.0.0',
              detail: '跨平台桌面应用\nElectron + Flask\n支持本地/远程 Ubuntu 系统管理',
            });
          },
        },
        {
          label: '打开数据目录',
          click: () => shell.openPath(app.getPath('userData')),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ================================================================
// 应用生命周期
// ================================================================
app.whenReady().then(async () => {
  console.log('[Main] Starting...');

  try {
    await startFlask(FLASK_PORT);
    createWindow();
  } catch (err) {
    console.error('[Main] Failed to start Flask:', err.message);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopFlask();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopFlask();
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled:', reason);
});
