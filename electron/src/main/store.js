/**
 * 设置持久化管理
 * 使用 electron-store 存储 SSH 配置、偏好设置等
 */
const Store = require('electron-store');

const store = new Store({
  name: 'config',
  encryptionKey: 'ubuntu-toolbox-v1', // 简单加密（保护 SSH 密码）
  defaults: {
    // SSH 服务器列表
    sshServers: [],
    // Flask 端口
    flaskPort: 38457,
    // 脚本执行超时（秒）
    scriptTimeout: 300,
    // 主题
    theme: 'system', // 'system' | 'light' | 'dark'
    // 语言
    language: 'zh-CN',
    // 上次选中的版本
    lastVersion: '',
    // 窗口大小
    windowBounds: { width: 1280, height: 800 },
  },
});

function loadConfig() {
  return store.store;
}

function saveConfig(config) {
  for (const [key, value] of Object.entries(config)) {
    store.set(key, value);
  }
  return true;
}

function getSetting(key) {
  return store.get(key);
}

function setSetting(key, value) {
  store.set(key, value);
  return true;
}

// SSH 服务器管理
function getSshServers() {
  return store.get('sshServers', []);
}

function addSshServer(server) {
  const servers = getSshServers();
  const id = require('uuid').v4();
  servers.push({ ...server, id });
  store.set('sshServers', servers);
  return id;
}

function updateSshServer(id, server) {
  const servers = getSshServers();
  const idx = servers.findIndex(s => s.id === id);
  if (idx !== -1) {
    servers[idx] = { ...servers[idx], ...server };
    store.set('sshServers', servers);
    return true;
  }
  return false;
}

function removeSshServer(id) {
  const servers = getSshServers().filter(s => s.id !== id);
  store.set('sshServers', servers);
  return true;
}

module.exports = {
  loadConfig,
  saveConfig,
  getSetting,
  setSetting,
  getSshServers,
  addSshServer,
  updateSshServer,
  removeSshServer,
  store,
};
