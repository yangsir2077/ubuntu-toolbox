/**
 * Electron 主进程入口
 * Ubuntu 工具箱桌面版
 */
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

// 子模块
const { startFlask, stopFlask, getFlaskUrl } = require('./flask-server');
const { registerIpcHandlers } = require('./ipc-handlers');
const { setupUpdaterEvents, checkForUpdates, downloadUpdate, quitAndInstall } = require('./updater');

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

  // 启动更新检查（延迟 3 秒，避免和 Flask 启动竞争）
  if (process.env.ELECTRON_UPDATE_URL) {
    setupUpdaterEvents(mainWindow);
    setTimeout(() => checkForUpdates(mainWindow), 3000);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    // macOS: 第一个item是app名称菜单（关于/退出）
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于 Ubuntu 工具箱', click: () => showAbout() },
        { type: 'separator' },
        {
          label: '检查更新...',
          click: () => checkForUpdates(mainWindow),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),

    // 文件菜单
    {
      label: '文件',
      submenu: isMac ? [] : [
        {
          label: '检查更新...',
          click: () => checkForUpdates(mainWindow),
        },
        { type: 'separator' },
        {
          label: '打开数据目录',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },

    // 编辑菜单（标准编辑操作）
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },

    // 视图菜单
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },

    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 Ubuntu 工具箱',
          click: () => showAbout(),
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

function showAbout() {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于 Ubuntu 工具箱',
    message: 'Ubuntu 工具箱',
    detail: `版本 ${app.getVersion()}\n跨平台桌面应用\nElectron + Flask\n支持本地/远程 Ubuntu 系统管理`,
  });
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
