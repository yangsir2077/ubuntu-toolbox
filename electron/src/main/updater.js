/**
 * 自动更新模块
 * 使用 electron-updater 实现版本检查和更新
 * 
 * 更新服务器结构（放在 Flask static 目录或任意 HTTP 服务器）：
 * /updates/latest.json 内容：
 * {
 *   "version": "1.1.0",
 *   "date": "2026-04-20",
 *   "notes": "修复了 XXX 问题",
 *   "files": [{ "url": "Ubuntu Toolbox-1.1.0.AppImage", "sha512": "..." }]
 * }
 */

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// 配置
const UPDATE_CONFIG = {
  // 更新检测间隔（毫秒），默认 1 小时
  checkIntervalMs: 60 * 60 * 1000,
  // 是否自动下载（默认 false，等用户确认）
  autoDownload: false,
  // 是否自动安装（默认 false）
  autoInstall: false,
  // GitHub releases 更新（自动从当前仓库的 latest release 拉取）
  // 也支持 ELECTRON_UPDATE_URL 环境变量指定自定义 JSON 服务器
  updateUrl: process.env.ELECTRON_UPDATE_URL || 'https://github.com/yangsir/ubuntu-toolbox',
};

// 日志配置
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// 更新事件
function setupUpdaterEvents(window) {
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] 检查更新中...');
    window?.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] 发现新版本:', info.version);
    window?.webContents.send('updater:status', {
      status: 'available',
      version: info.version,
      notes: info.releaseNotes,
      date: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] 已是最新版本:', info.version);
    window?.webContents.send('updater:status', { status: 'up-to-date', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[Updater] 下载中: ${progress.percent.toFixed(1)}%`);
    window?.webContents.send('updater:status', {
      status: 'downloading',
      percent: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] 下载完成:', info.version);
    window?.webContents.send('updater:status', {
      status: 'ready',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('[Updater] 更新出错:', err.message);
    window?.webContents.send('updater:status', { status: 'error', message: err.message });
  });
}

// 检查更新
async function checkForUpdates(window) {
  if (!UPDATE_CONFIG.updateUrl) {
    log.info('[Updater] 未配置更新服务器，跳过检查');
    window?.webContents.send('updater:status', { status: 'no-url', message: '未配置更新服务器' });
    return { status: 'no-url' };
  }
  try {
    const isGithub = UPDATE_CONFIG.updateUrl.includes('github.com');
    if (isGithub) {
      autoUpdater.setFeedURL({ provider: 'github', repo: UPDATE_CONFIG.updateUrl });
    } else {
      autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_CONFIG.updateUrl });
    }
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    log.error('[Updater] 检查更新失败:', err.message);
    window?.webContents.send('updater:status', { status: 'error', message: err.message });
    return null;
  }
}

// 下载更新
async function downloadUpdate() {
  try {
    return await autoUpdater.downloadUpdate();
  } catch (err) {
    log.error('[Updater] 下载更新失败:', err.message);
    return null;
  }
}

// 安装更新并重启
function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true);
}

module.exports = {
  setupUpdaterEvents,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
};
