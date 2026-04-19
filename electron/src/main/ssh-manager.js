/**
 * SSH 管理器
 * 使用 ssh2 库管理 SSH 连接和远程执行
 */
const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
// 活跃的 SSH 连接
const activeConnections = new Map();

// 连接到 SSH 服务器
function sshConnect(config) {
  return new Promise((resolve, reject) => {
    const connectionId = config.id || uuidv4();
    const conn = new Client();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('连接超时（30秒）'));
    }, 30000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      console.log(`[SSH] Connected to ${config.host}`);

      activeConnections.set(connectionId, {
        client: conn,
        config: {
          id: connectionId,
          name: config.name || config.host,
          host: config.host,
          port: config.port || 22,
          username: config.username,
          authType: config.authType, // 'password' | 'privateKey'
          // 不存储明文密码
        },
        connectedAt: Date.now(),
      });

      resolve({ success: true, connectionId, name: config.name || config.host });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[SSH] Connection error:`, err.message);
      reject(new Error(`连接失败: ${err.message}`));
    });

    conn.on('close', () => {
      console.log(`[SSH] Connection closed: ${connectionId}`);
      activeConnections.delete(connectionId);
    });

    // 构建连接参数
    const connectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
    };

    if (config.authType === 'privateKey') {
      // 私钥认证
      try {
        if (fs.existsSync(config.privateKeyPath)) {
          connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
          if (config.passphrase) {
            connectConfig.passphrase = config.passphrase;
          }
        } else {
          reject(new Error(`私钥文件不存在: ${config.privateKeyPath}`));
          return;
        }
      } catch (err) {
        reject(new Error(`读取私钥失败: ${err.message}`));
        return;
      }
    } else {
      // 密码认证
      if (!config.password) {
        reject(new Error('密码不能为空'));
        return;
      }
      connectConfig.password = config.password;
    }

    conn.connect(connectConfig);
  });
}

// 执行 SSH 命令
function sshExecute(connectionId, command) {
  return new Promise((resolve, reject) => {
    const connection = activeConnections.get(connectionId);
    if (!connection || !connection.client) {
      reject(new Error('SSH 未连接'));
      return;
    }

    connection.client.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`执行失败: ${err.message}`));
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code,
        });
      });

      stream.on('data', (data) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

// 断开 SSH 连接
function sshDisconnect(connectionId) {
  const connection = activeConnections.get(connectionId);
  if (connection) {
    connection.client.end();
    activeConnections.delete(connectionId);
  }
  return true;
}

// 获取单个连接（内部使用）
function _getConnection(id) {
  return activeConnections.get(id);
}

// 获取当前活跃连接列表
function sshGetConnections() {
  return Array.from(activeConnections.values()).map(c => ({
    id: c.config.id,
    name: c.config.name,
    host: c.config.host,
    port: c.config.port,
    username: c.config.username,
    connectedAt: c.connectedAt,
    // 不暴露敏感信息
  }));
}

module.exports = {
  sshConnect,
  sshExecute,
  sshDisconnect,
  sshGetConnections,
  _getConnection,
};
