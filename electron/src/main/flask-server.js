/**
 * Flask 后台服务管理
 * Electron 启动时 fork 一个 Flask 子进程
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let flaskProcess = null;
let flaskUrl = '';
let flaskPort = 38457;

// 获取项目根目录（electron/ 上两级）
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const APP_PY = path.join(PROJECT_ROOT, 'app.py');

function startFlask(port) {
  return new Promise((resolve, reject) => {
    flaskPort = port;
    flaskUrl = `http://127.0.0.1:${port}`;

    // 检查 app.py 是否存在
    if (!fs.existsSync(APP_PY)) {
      console.error('[Flask] app.py not found at:', APP_PY);
      reject(new Error('app.py not found'));
      return;
    }

    // 启动 Flask（生产模式用 gunicorn，开发模式用 python）
    const isProduction = process.env.NODE_ENV === 'production';
    let args;
    let exe;

    if (isProduction) {
      exe = 'gunicorn';
      args = ['--bind', `127.0.0.1:${port}`, '--workers', '2', '--timeout', '120', 'app:app'];
    } else {
      exe = 'python3';
      args = [APP_PY];
    }

    // 设置环境变量
    const env = {
      ...process.env,
      FLASK_PORT: port.toString(),
      FLASK_APP: 'app.py',
      // 防止 Flask 打开浏览器
      ELECTRON_RUN: '1',
    };

    console.log('[Flask] Starting with:', exe, args.join(' '));
    flaskProcess = spawn(exe, args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let started = false;

    flaskProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log('[Flask stdout]', msg);
      if (!started && (msg.includes('Running on') || msg.includes('127.0.0.1'))) {
        started = true;
        console.log('[Flask] Server started successfully');
        resolve();
      }
    });

    flaskProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      // 忽略常见无害警告
      if (msg.includes('Warning') || msg.includes('DeprecationWarning')) return;
      console.log('[Flask stderr]', msg);
    });

    flaskProcess.on('error', (err) => {
      console.error('[Flask] Process error:', err);
      reject(err);
    });

    flaskProcess.on('exit', (code) => {
      console.log('[Flask] Process exited with code:', code);
      flaskProcess = null;
    });

    // 超时处理：5秒内没启动算失败
    setTimeout(() => {
      if (!started) {
        // 再等2秒
        setTimeout(() => {
          if (!started && flaskProcess) {
            console.error('[Flask] Failed to start within timeout');
            reject(new Error('Flask startup timeout'));
          } else if (started) {
            resolve();
          }
        }, 2000);
      }
    }, 1000);
  });
}

function stopFlask() {
  if (flaskProcess) {
    console.log('[Flask] Stopping...');
    flaskProcess.kill('SIGTERM');
    // 等待一下再强制 kill
    setTimeout(() => {
      if (flaskProcess) {
        flaskProcess.kill('SIGKILL');
        flaskProcess = null;
      }
    }, 2000);
  }
}

function getFlaskUrl() {
  return flaskUrl || `http://127.0.0.1:${flaskPort}`;
}

module.exports = { startFlask, stopFlask, getFlaskUrl };
