#!/bin/bash
# 手动下载并安装 Electron 二进制
# 解决国内网络无法从 GitHub 下载的问题

set -e

ELECTRON_VERSION="33.0.0"
ELECTRON_DIR="/media/yhj/data/ubuntu-toolbox/electron/node_modules/electron"
MIRROR="https://npmmirror.com/mirrors/electron"

echo "==> 下载 Electron v${ELECTRON_VERSION}..."
mkdir -p "$ELECTRON_DIR/dist"

cd /tmp
rm -f electron.zip
wget -c "${MIRROR}/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-x64.zip" -O electron.zip

echo "==> 解压到 $ELECTRON_DIR/dist/..."
unzip -o electron.zip -d "$ELECTRON_DIR/dist_tmp"
mv "$ELECTRON_DIR/dist_tmp/electron-v${ELECTRON_VERSION}-linux-x64/"* "$ELECTRON_DIR/dist/"
rm -rf "$ELECTRON_DIR/dist_tmp"
rm -f /tmp/electron.zip

echo "==> 下载 chrome-sandbox..."
wget -c "${MIRROR}/v${ELECTRON_VERSION}/chromium-x64-${ELECTRON_VERSION}-chrome-linux.zip" -O /tmp/chrome-sandbox.zip 2>/dev/null || true

echo "==> 修复权限..."
chmod +x "$ELECTRON_DIR/dist/electron"

echo "✅ Electron 安装完成！"
echo "路径: $ELECTRON_DIR/dist/electron"
ls -la "$ELECTRON_DIR/dist/electron"
