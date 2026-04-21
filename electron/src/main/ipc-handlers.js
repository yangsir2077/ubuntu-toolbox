/**
 * IPC 处理器注册（从 index.js 分离）
 */
const { ipcMain } = require('electron');
const { app } = require('electron');
const { getFlaskUrl } = require('./flask-server');
const { checkForUpdates, downloadUpdate, quitAndInstall } = require('./updater');
const {
  executeScript,
  terminateScript,
  getSystemVersion,
  setMainWindow,
} = require('./script-executor');
const {
  sshConnect,
  sshExecute,
  sshDisconnect,
  sshGetConnections,
} = require('./ssh-manager');
const {
  loadConfig,
  saveConfig,
  getSetting,
  setSetting,
  getSshServers,
  addSshServer,
  updateSshServer,
  removeSshServer,
} = require('./store');

function registerIpcHandlers(mainWindow) {
  // 把 mainWindow 注入到 script-executor（用于实时推送输出）
  setMainWindow(mainWindow);

  // -------- 系统信息 --------
  ipcMain.handle('system:version', async () => getSystemVersion());
  ipcMain.handle('system:platform', async () => process.platform);
  ipcMain.handle('system:platforms', async () => ({
    darwin: process.platform === 'darwin',
    win32: process.platform === 'win32',
    linux: process.platform === 'linux',
  }));

  // -------- Flask 状态 --------
  ipcMain.handle('flask:url', async () => getFlaskUrl());
  ipcMain.handle('flask:status', async () => ({ running: true, port: 38457, url: getFlaskUrl() }));

  // -------- 脚本执行 --------
  ipcMain.handle('script:execute', async (event, { scriptId, version, isRemote, sshServerId }) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    return executeScript(scriptId, version, isRemote, sshServerId, (data) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('script:output', { scriptId, ...data });
      }
    });
  });

  ipcMain.handle('script:terminate', async (event, scriptId) => terminateScript(scriptId));

  // -------- SSH --------
  ipcMain.handle('ssh:connect', async (event, serverConfig) => sshConnect(serverConfig));
  ipcMain.handle('ssh:execute', async (event, { connectionId, command }) => sshExecute(connectionId, command));
  ipcMain.handle('ssh:disconnect', async (event, connectionId) => sshDisconnect(connectionId));
  ipcMain.handle('ssh:getConnections', async () => sshGetConnections());

  // -------- SSH 服务器 CRUD --------
  ipcMain.handle('ssh:getServers', async () => getSshServers());
  ipcMain.handle('ssh:addServer', async (event, server) => addSshServer(server));
  ipcMain.handle('ssh:updateServer', async (event, { id, server }) => updateSshServer(id, server));
  ipcMain.handle('ssh:removeServer', async (event, id) => removeSshServer(id));

  // -------- 设置 --------
  ipcMain.handle('settings:get', async (event, key) => getSetting(key));
  ipcMain.handle('settings:set', async (event, key, value) => setSetting(key, value));
  ipcMain.handle('settings:getAll', async () => loadConfig());
  ipcMain.handle('settings:saveAll', async (event, config) => saveConfig(config));

  // -------- Electron 专用 --------
  ipcMain.handle('electron:openExternal', async (event, url) => {
    require('electron').shell.openExternal(url);
    return true;
  });

  ipcMain.handle('electron:showItemInFolder', async (event, filePath) => {
    require('electron').shell.showItemInFolder(filePath);
    return true;
  });

  // -------- 自动更新 --------
  ipcMain.handle('updater:check', async (event) => {
    return await checkForUpdates(event.sender.getOwnerBrowserWindow());
  });

  ipcMain.handle('electron:version', async () => app.getVersion());

  ipcMain.handle('updater:download', async () => {
    return await downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    quitAndInstall();
  });
}

module.exports = { registerIpcHandlers };
