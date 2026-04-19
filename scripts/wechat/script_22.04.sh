#!/bin/bash
# Ubuntu 22.04 安装微信
# 使用 Snap 版 electronic-wechat (Deepin Wine 源已失效)
set -e

echo "==> 检查 Snapd..."
if ! command -v snap &>/dev/null; then
    echo "==> 安装 Snapd..."
    sudo apt update -qq
    sudo apt install -y snapd
    sudo systemctl enable --now snapd.socket snapd.apparmor
fi

echo "==> 安装 electronic-wechat..."
sudo snap install electronic-wechat --classic

echo ""
echo "✅ 微信安装完成！"
echo "启动方式: snap run electronic-wechat"
