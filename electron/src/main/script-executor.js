/**
 * 本地脚本执行器
 * 使用 node-pty 创建伪终端，支持实时输出和终止
 */
const pty = require('node-pty');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


// 正在运行的脚本进程
const runningProcesses = new Map();
// mainWindow 引用（由 ipc-handlers 设置）
let _mainWindow = null;

function setMainWindow(win) { _mainWindow = win; }
function getMainWindow() { return _mainWindow; }

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

// 获取系统版本
function getSystemVersion() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('lsb_release -rs 2>/dev/null || cat /etc/os-release | grep VERSION_ID | cut -d= -f2', (err, stdout) => {
      if (err) {
        resolve({ version: 'unknown', prettyName: 'Ubuntu (unknown)' });
        return;
      }
      const version = stdout.trim().replace(/"/g, '');
      exec('lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2', (err2, pretty) => {
        resolve({
          version: version || 'unknown',
          prettyName: (pretty.trim().replace(/"/g, '') || 'Ubuntu').split(' ')[0] + ' ' + (version || ''),
        });
      });
    });
  });
}

// 读取脚本内容
function readScriptFile(scriptId, version) {
  const scriptDir = path.join(SCRIPTS_DIR, scriptId);
  let scriptPath = path.join(scriptDir, 'script.sh');

  if (version && version !== '') {
    const verPath = path.join(scriptDir, `script_${version}.sh`);
    if (fs.existsSync(verPath)) {
      scriptPath = verPath;
    }
  }

  if (!fs.existsSync(scriptPath)) {
    return null;
  }

  let content = fs.readFileSync(scriptPath, 'utf8');

  // 替换占位符
  const curUser = os.userInfo().username;
  content = content.replace(/\{CUR_USER\}/g, curUser);
  content = content.replace(/\{HOME_DIR\}/g, os.homedir());

  return content;
}

// 执行本地脚本
function executeScript(scriptId, version, isRemote, sshServerId, onOutput) {
  const sessionId = uuidv4();

  if (isRemote && sshServerId) {
    // SSH 远程执行
    return executeRemoteScript(sessionId, scriptId, version, sshServerId, onOutput);
  }

  // 本地执行
  const scriptContent = readScriptFile(scriptId, version);
  if (!scriptContent) {
    onOutput({ type: 'error', data: `脚本 ${scriptId} 不存在` });
    return { success: false, error: 'Script not found' };
  }

  // 创建临时脚本文件
  const tmpFile = path.join(os.tmpdir(), `ubuntu-toolbox-${sessionId}.sh`);
  fs.writeFileSync(tmpFile, scriptContent, { mode: 0o755 });

  onOutput({ type: 'info', data: `[本地执行] ${scriptId} (${version || '通用'})\n` });
  onOutput({ type: 'info', data: `用户: ${os.userInfo().username} | 主机: ${os.hostname()}\n` });
  onOutput({ type: 'info', data: '─'.repeat(50) + '\n' });

  const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

  const ptyProcess = pty.spawn(shell, ['-c', `chmod 755 "${tmpFile}" && "${tmpFile}"`], {
    name: 'xterm-color',
    cols: 120,
    rows: 30,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      DEBIAN_FRONTEND: 'noninteractive',
      SCRIPT_SESSION_ID: sessionId,
    },
  });

  runningProcesses.set(sessionId, { pty: ptyProcess, type: 'local', scriptId });

  ptyProcess.onData((data) => {
    onOutput({ type: 'stdout', data });
  });

  ptyProcess.onExit(({ exitCode }) => {
    onOutput({ type: 'exit', exitCode, sessionId });
    runningProcesses.delete(sessionId);
    // 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  });

  return { success: true, sessionId };
}

// SSH 远程执行
// 懒加载 ssh-manager（避免循环依赖）
let _sshManager = null;
function getSshManager() {
  if (!_sshManager) _sshManager = require('./ssh-manager');
  return _sshManager;
}

async function executeRemoteScript(sessionId, scriptId, version, sshServerId, onOutput) {
  const scriptContent = readScriptFile(scriptId, version);
  if (!scriptContent) {
    onOutput({ type: 'error', data: `脚本 ${scriptId} 不存在` });
    return { success: false, error: 'Script not found' };
  }

  const conn = getSshManager()._getConnection(sshServerId);
  if (!conn || !conn.client) {
    onOutput({ type: 'error', data: `SSH 服务器 ${sshServerId} 未连接` });
    return { success: false, error: 'Not connected' };
  }

  onOutput({ type: 'info', data: `[远程执行] ${scriptId} @ ${conn.config.name}\n` });
  onOutput({ type: 'info', data: `地址: ${conn.config.host}:${conn.config.port}\n` });
  onOutput({ type: 'info', data: '─'.repeat(50) + '\n' });

  // 上传脚本到远程/tmp 执行
  const remotePath = `/tmp/ubuntu-toolbox-${sessionId}.sh`;
  const tmpContent = scriptContent
    .replace(/\{CUR_USER\}/g, conn.config.username)
    .replace(/\{HOME_DIR\}/g, `/home/${conn.config.username}`);

  try {
    // 写入远程文件
    await new Promise((resolve, reject) => {
      conn.client.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        sftp.writeFile(remotePath, tmpContent, { mode: 0o755 }, (err2) => {
          if (err2) { reject(err2); return; }
          resolve();
        });
      });
    });

    // 执行
    conn.client.exec(`bash "${remotePath}"`, (err, stream) => {
      if (err) {
        onOutput({ type: 'error', data: `执行失败: ${err.message}\n` });
        return;
      }

      let outputBuffer = '';
      stream.on('close', (code) => {
        onOutput({ type: 'exit', exitCode: code, sessionId });
        // 清理远程文件
        conn.client.exec(`rm -f "${remotePath}"`, () => {});
      });
      stream.on('data', (data) => {
        const text = data.toString();
        onOutput({ type: 'stdout', data: text });
      });
      stream.stderr.on('data', (data) => {
        onOutput({ type: 'stdout', data: data.toString() });
      });
    });

    return { success: true, sessionId };
  } catch (err) {
    onOutput({ type: 'error', data: `SSH 执行失败: ${err.message}\n` });
    return { success: false, error: err.message };
  }
}

// 终止脚本
function terminateScript(sessionId) {
  const proc = runningProcesses.get(sessionId);
  if (proc) {
    if (proc.type === 'local' && proc.pty) {
      proc.pty.kill('SIGTERM');
    }
    runningProcesses.delete(sessionId);
    return true;
  }

  // 查找并清理
  for (const [sid, p] of runningProcesses.entries()) {
    if (sid === sessionId) {
      p.pty?.kill('SIGTERM');
      runningProcesses.delete(sid);
      return true;
    }
  }
  return false;
}

module.exports = {
  executeScript,
  terminateScript,
  getSystemVersion,
  setMainWindow,
  getMainWindow,
};
