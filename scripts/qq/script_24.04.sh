#!/bin/bash
# Ubuntu 24.04 安装 QQ
# 使用 Snap 版 icalingua (Deepin Wine 源已失效)
set -e

echo "==> 检查 Snapd..."
if ! command -v snap &>/dev/null; then
    echo "==> 安装 Snapd..."
    sudo apt update -qq
    sudo apt install -y snapd
    sudo systemctl enable --now snapd.socket snapd.apparmor
fi

echo "==> 安装 icalingua..."
sudo snap install icalingua --classic

echo ""
echo "✅ QQ 安装完成！"
echo "启动方式: snap run icalingua"
