# Ubuntu 工具箱 Electron 桌面版 - 实现计划

## 项目概述

将现有 Flask Web 项目用 Electron 包装为跨平台桌面应用，支持本地脚本执行、实时日志、SSH 远程操作，打包为 Windows/macOS/Linux 三平台安装包。

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   Electron Main Process              │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Flask Server │  │ Script Exec │  │  SSH Mgr  │  │
│  │ (subprocess) │  │  (node-pty) │  │  (ssh2)   │  │
│  └──────────────┘  └─────────────┘  └───────────┘  │
│         │                 │                │        │
│         └────────────┬────┴────────────────┘        │
│                      │ IPC Bridge (contextBridge)   │
├──────────────────────┼─────────────────────────────┤
│   Electron Preload   │  (安全桥接，只暴露必要 API)   │
├──────────────────────┼─────────────────────────────┤
│                   Web App (Flask 渲染)              │
│   原有 index.html  +  Electron 扩展 (终端/SSH/设置)  │
└─────────────────────────────────────────────────────┘
```

## 目录结构

```
electron/                          # Electron 项目根目录
├── package.json                   # 依赖和脚本
├── electron-builder.yml           # 多平台打包配置
├── vite.config.mjs               # Vite bundler 配置
├── README.md                      # 构建说明
├── BUILD.sh                       # Linux 打包脚本
├── BUILD.bat                      # Windows 打包脚本
├── BUILD.mac.sh                   # macOS 打包脚本
│
├── src/
│   ├── main/
│   │   ├── index.js              # 主进程入口
│   │   ├── flask-server.js       # Flask 子进程管理
│   │   ├── script-executor.js    # 本地脚本执行（node-pty）
│   │   ├── ssh-manager.js        # SSH 远程执行（ssh2）
│   │   ├── store.js              # electron-store 设置持久化
│   │   └── ipc-handlers.js       # IPC 事件注册
│   │
│   ├── preload/
│   │   └── index.js              # 预加载脚本（安全桥接）
│   │
│   └── renderer/                  # Electron 专用前端
│       ├── electron.js            # Electron API 入口（注入到 Flask 页面）
│       ├── settings/
│       │   ├── panel.js           # 设置面板逻辑
│       │   └── style.css          # 设置面板样式
│       ├── terminal/
│       │   ├── output.js          # 实时终端输出
│       │   └── style.css          # 终端样式
│       └── ssh/
│           ├── manager.js         # SSH 连接管理 UI
│           └── style.css          # SSH 样式
│
│
```

## 功能模块详细设计

### 1. Flask 服务管理
- **启动**：Electron 启动时自动 fork 一个 subprocess 运行 `python3 app.py`
- **端口**：默认 38457（避免和 5000 冲突）
- **停止**：Electron 退出时自动 kill Flask 进程
- **地址**：`http://127.0.0.1:{FLASK_PORT}`

### 2. 本地脚本执行器
- **库**：node-pty（创建伪终端）
- **协议**：IPC `script:execute` / `script:output` / `script:terminate`
- **行为**：子进程 stdout/stderr 实时通过 IPC 推送到渲染进程
- **超时控制**：默认 5 分钟，支持手动终止

### 3. SSH 远程执行
- **库**：ssh2（Node.js SSH 客户端）
- **连接信息存储**：electron-store（加密存储在用户目录）
- **执行流程**：连接 → 上传脚本 → 执行 → 返回日志
- **多服务器**：支持配置多个服务器标签，切换执行

### 4. 设置面板
- **存储**：electron-store（JSON，位于 `~/.ubuntu-toolbox/config.json`）
- **内容**：
  - SSH 服务器列表（名称/地址/端口/用户名/认证方式/密钥路径）
  - Flask 启动端口偏好
  - 主题（跟随系统/深色/浅色）
  - 脚本执行超时时间
- **UI**：在 Flask 页面内以 modal 方式呈现（避免跨域问题）

### 5. 系统版本检测
- **触发**：Electron 启动时自动执行 `lsb_release -rs`
- **注入**：版本号通过 IPC 发送给渲染进程，设置页面已选中版本

### 6. 跨平台打包
- **工具**：electron-builder
- **目标**：
  - Linux: `.AppImage` / `.deb`
  - Windows: `.exe` (NSIS installer)
  - macOS: `.dmg`
- **自动更新**：预留 electron-updater 接口（暂时不启用）

## 实现步骤

### 第一阶段：Electron 骨架（基础可运行）
1. `npm init` 初始化项目
2. 安装核心依赖：electron, electron-builder, vite, node-pty, ssh2, electron-store
3. 编写 `src/main/index.js`（窗口创建 + Flask 启动）
4. 编写 `src/preload/index.js`（安全桥接 API）
5. 改造 Flask 页面：添加 Electron.js 注入脚本
6. 验证：Electron 启动 → Flask 运行 → 页面可访问

### 第二阶段：本地脚本执行
7. 实现 `script-executor.js`（node-pty 封装）
8. 实现 IPC handlers（execute / terminate / output）
9. 编写 renderer 端 terminal 样式和逻辑
10. 在 Flask 页面添加「本地运行」按钮 + 实时日志面板
11. 添加版本自动检测和填充

### 第三阶段：SSH 远程操作
12. 实现 `ssh-manager.js`（ssh2 封装）
13. 实现设置面板 UI（modal + 表单 + 保存）
14. SSH 服务器 CRUD（增删改查）
15. SSH 执行结果实时回显
16. 多服务器切换 UI

### 第四阶段：打包与文档
17. 配置 `electron-builder.yml`
18. 编写 `BUILD.sh` / `BUILD.bat` / `BUILD.mac.sh`
19. 编写 `electron/README.md`
20. 完整测试全流程

## 依赖清单

```json
{
  "electron": "^33.0.0",
  "electron-builder": "^25.0.0",
  "electron-store": "^10.0.0",
  "node-pty": "^1.0.0",
  "ssh2": "^1.16.0",
  "uuid": "^11.0.0"
}
```

## 构建目标

| 平台 | 格式 | 架构 |
|------|------|------|
| Linux | AppImage + deb | x64, arm64 |
| Windows | NSIS .exe | x64 |
| macOS | DMG | x64, arm64 |

## 注意事项

- **node-pty 需要编译**：Linux/macOS 需要 `python3`、`make`、`g++`
- **ssh2 需编译**：同上
- **macOS 签名**：可选，暂时跳过
- **Windows 打包**：建议在 Linux 上用 `electron-builder --win` 交叉打包
- **安全**：SSH 密码/私钥通过 electron-store 加密存储，不写入日志
