#!/bin/bash
# ============================================================
# Ubuntu 工具箱桌面版 - macOS 平台打包脚本
# 用法: ./BUILD.mac.sh [dmg|all]
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "Ubuntu 工具箱 - macOS 打包"
echo "========================================"

# 检查系统
if [[ "$(uname)" != "Darwin" ]]; then
    echo "⚠️  建议在 macOS 本机上运行此脚本"
fi

# 检查 Node.js
if ! command -v node &>/dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 安装依赖
echo "==> 安装依赖..."
npm install --ignore-scripts 2>/dev/null || npm install

# 编译 native 模块
echo "==> 编译 native 模块..."
npm run postinstall 2>/dev/null || (
    if [ -d "node_modules/node-pty" ]; then
        (cd node_modules/node-pty && npx node-gyp configure && npx node-gyp build)
    fi
)

# 决定打包目标
TARGET="${1:-all}"
case "$TARGET" in
    dmg)   TARGETS="--mac dmg" ;;
    all)   TARGETS="--mac" ;;
    *)     echo "用法: $0 [dmg|all]"; exit 1 ;;
esac

echo "==> 打包目标: $TARGET"
echo "==> 这可能需要几分钟，请耐心等待..."

# 执行打包
npx electron-builder $TARGETS

echo ""
echo "========================================"
echo "✅ 打包完成！"
echo "安装包位于 dist/ 目录："
ls -lh dist/ 2>/dev/null || echo "dist 目录为空"
echo "========================================"
