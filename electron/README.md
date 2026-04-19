# Ubuntu 工具箱桌面版

基于 Flask Web 项目，使用 Electron 打包为跨平台桌面应用。

## 功能特性

| 功能 | 说明 |
|------|------|
| 🤖 自动版本检测 | 启动时自动检测 Ubuntu 版本，自动选择对应脚本 |
| ⚡ 本地脚本执行 | 在 Electron 内置终端实时执行脚本，实时显示输出日志 |
| 🖥️ SSH 远程操作 | 配置服务器后，可远程执行脚本到多台服务器 |
| ⚙️ 设置面板 | 管理 SSH 连接、Flask 端口、超时等偏好设置 |
| 🌐 跨平台打包 | 支持 Linux / Windows / macOS 三大平台 |

## 架构说明

```
┌──────────────────────────────────────────────┐
│              Electron Main Process           │
│  ┌─────────────┐  ┌──────────────┐          │
│  │ Flask Server │  │ Script Runner │          │
│  │ (子进程)     │  │  (node-pty)   │          │
│  └─────────────┘  └──────────────┘          │
│  ┌─────────────┐  ┌──────────────┐          │
│  │ SSH Manager │  │  Settings    │          │
│  │  (ssh2)     │  │(electron-store)│          │
│  └─────────────┘  └──────────────┘          │
│                    │ IPC (contextBridge)      │
├────────────────────┼──────────────────────────┤
│  Preload (安全桥接) │ window.ELECTRON_BRIDGE  │
├────────────────────┼──────────────────────────┤
│  Renderer Process  │ Flask 页面 + electron.js │
└──────────────────────────────────────────────┘
```

## 目录结构

```
electron/
├── package.json           # 项目依赖
├── electron-builder.yml   # 打包配置
├── BUILD.sh               # Linux 打包脚本
├── BUILD.bat              # Windows 打包脚本
├── BUILD.mac.sh           # macOS 打包脚本
├── README.md              # 本文档
│
├── src/
│   ├── main/              # 主进程
│   │   ├── index.js       # 主进程入口，窗口管理
│   │   ├── flask-server.js# Flask 子进程管理
│   │   ├── script-executor.js # 脚本执行（node-pty）
│   │   ├── ssh-manager.js # SSH 连接管理（ssh2）
│   │   ├── store.js       # 设置持久化（electron-store）
│   │   └── ipc-handlers.js# IPC 事件注册
│   │
│   ├── preload/           # 预加载（安全桥接）
│   │   └── index.js       # contextBridge API 暴露
│   │
│   └── renderer/          # 渲染层（注入 Flask 页面）
│       └── electron.js    # Electron 扩展逻辑
│
└── assets/                # 应用图标
    └── icon.png/ico/icns
```

## 快速开始

### 开发模式

```bash
cd electron
npm install
npm run dev          # 启动 Electron 开发模式
```

### 生产打包

**Linux:**
```bash
./BUILD.sh           # 打包为 AppImage + deb
./BUILD.sh appimage  # 只打包 AppImage
./BUILD.sh deb       # 只打包 deb
```

**Windows:**
```bat
BUILD.bat
```

**macOS:**
```bash
./BUILD.mac.sh       # 打包为 DMG
./BUILD.mac.sh dmg   # 只打包 DMG
```

**三平台同时打包（需要 Linux 环境）:**
```bash
npx electron-builder -mwl
```

## 打包输出

| 平台 | 格式 | 输出位置 |
|------|------|----------|
| Linux | `.AppImage` / `.deb` | `dist/` |
| Windows | `.exe` (NSIS 安装器) | `dist/` |
| macOS | `.dmg` | `dist/` |

## SSH 服务器配置

打开应用后点击 **⚙️ 设置 → 添加服务器**，填写：

- **服务器名称**：如「生产服务器」
- **IP/主机名**：服务器的 IP 或域名
- **端口**：SSH 端口，默认 22
- **用户名**：登录用户名
- **认证方式**：密码 / 私钥 二选一
- **私钥路径**：使用私钥认证时填写（如 `~/.ssh/id_rsa`）

配置后可在脚本执行时选择「远程执行」到指定服务器。

## 系统要求

| 组件 | 要求 |
|------|------|
| Node.js | ≥ 18.0.0 |
| Python | ≥ 3.8 (运行 Flask) |
| 编译工具 | python3, make, g++ (Linux/macOS 编译 native 模块) |

## 注意事项

1. **node-pty / ssh2 编译**：Linux/macOS 首次打包需要编译 C++ 扩展，确保安装了 `build-essential` / `xcode-select`
2. **SSH 私钥**：私钥文件路径使用 `~` 会被替换为实际 home 目录
3. **macOS 打包**：建议在 macOS 本机上运行，或使用 macOS VM
4. **Windows 交叉打包**：Linux 上无法打包 Windows .exe（需要 `wine` + `mono`）
5. **Electron 版本**：如遇兼容性问题，检查 `package.json` 中的 electron 版本

## 添加新模块

1. 在 `../scripts/` 下添加新目录和脚本文件
2. 在 `../app.py` 的 `MODULE_REGISTRY` 中注册模块
3. 在 `../templates/index.html` 中添加卡片 HTML
4. 无需修改 Electron 代码——Flask 页面改动会自动反映到桌面应用中

## License

MIT
