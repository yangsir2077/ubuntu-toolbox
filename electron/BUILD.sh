#!/bin/bash
# ============================================================
# Ubuntu 工具箱桌面版 - Linux 平台打包脚本
# 用法: ./BUILD.sh [appimage|deb|all]
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "Ubuntu 工具箱 - Linux 打包"
echo "========================================"

# 检查依赖
if ! command -v node &>/dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

# 检查 node-gyp（编译 native 模块需要）
if ! command -v python3 &>/dev/null; then
    echo "❌ python3 未安装（编译 node-pty 需要）"
    exit 1
fi

# 安装依赖
echo "==> 安装依赖..."
npm install --ignore-scripts 2>/dev/null || npm install

# 编译 native 模块（node-pty, ssh2）
echo "==> 编译 native 模块..."
npm run postinstall 2>/dev/null || (
    # 手动编译 node-pty
    if [ -d "node_modules/node-pty" ]; then
        (cd node_modules/node-pty && npx node-gyp configure && npx node-gyp build)
    fi
    # 手动编译 ssh2（通常不需要编译，但保险起见）
    if [ -d "node_modules/ssh2" ]; then
        (cd node_modules/ssh2 && npx node-gyp configure && npx node-gyp build) 2>/dev/null || true
    fi
)

# 决定打包目标
TARGET="${1:-all}"
case "$TARGET" in
    appimage)   TARGETS="--linux appimage" ;;
    deb)        TARGETS="--linux deb" ;;
    all)        TARGETS="--linux" ;;
    *)          echo "用法: $0 [appimage|deb|all]"; exit 1 ;;
esac

echo "==> 打包目标: $TARGET"
echo "==> 这可能需要几分钟，请耐心等待..."

# 执行打包（使用国内镜像下载 Electron）
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npx electron-builder $TARGETS

echo ""
echo "========================================"
echo "✅ 打包完成！"
echo "安装包位于 dist/ 目录："
ls -lh dist/
echo "========================================"
