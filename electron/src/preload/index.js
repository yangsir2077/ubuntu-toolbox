/**
 * Preload 脚本 - 安全桥接层
 * 只暴露必要的 API 给渲染进程（Flask 页面）
 * contextIsolation: true + nodeIntegration: false 的安全模式
 */
const { contextBridge, ipcRenderer } = require('electron');

// ================================================================
// 暴露给渲染进程的 API（Flask 页面通过 window.ELECTRON_BRIDGE 调用）
// ================================================================
contextBridge.exposeInMainWorld('ELECTRON_BRIDGE', {

  // -------- 系统信息 --------
  getSystemVersion: () => ipcRenderer.invoke('system:version'),
  getPlatform: () => ipcRenderer.invoke('system:platform'),
  getPlatforms: () => ipcRenderer.invoke('system:platforms'),

  // -------- Flask 状态 --------
  getFlaskUrl: () => ipcRenderer.invoke('flask:url'),
  getFlaskStatus: () => ipcRenderer.invoke('flask:status'),

  // -------- 脚本执行 --------
  executeScript: (opts) => ipcRenderer.invoke('script:execute', opts),
  terminateScript: (sessionId) => ipcRenderer.invoke('script:terminate', sessionId),

  // 监听脚本输出（实时日志）
  onScriptOutput: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('script:output', listener);
    // 返回移除函数
    return () => ipcRenderer.removeListener('script:output', listener);
  },

  // -------- SSH --------
  sshConnect: (config) => ipcRenderer.invoke('ssh:connect', config),
  sshExecute: (opts) => ipcRenderer.invoke('ssh:execute', opts),
  sshDisconnect: (connectionId) => ipcRenderer.invoke('ssh:disconnect', connectionId),
  sshGetConnections: () => ipcRenderer.invoke('ssh:getConnections'),

  // SSH 服务器 CRUD
  sshGetServers: () => ipcRenderer.invoke('ssh:getServers'),
  sshAddServer: (server) => ipcRenderer.invoke('ssh:addServer', server),
  sshUpdateServer: (opts) => ipcRenderer.invoke('ssh:updateServer', opts),
  sshRemoveServer: (id) => ipcRenderer.invoke('ssh:removeServer', id),

  // -------- 设置 --------
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  saveAllSettings: (config) => ipcRenderer.invoke('settings:saveAll', config),

  // -------- Electron 专用 --------
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke('electron:openExternal', url),
  showItemInFolder: (path) => ipcRenderer.invoke('electron:showItemInFolder', path),

  // -------- 平台检测 --------
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',

  // -------- 自动更新 --------
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater:status', (event, data) => callback(data));
  },
});
