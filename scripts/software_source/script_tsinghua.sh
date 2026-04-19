#!/bin/bash
# 一键更换为清华软件源
set -e
echo "==> 正在备份原软件源..."
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)
echo "==> 更换为清华源..."
# 自动检测版本
. /etc/os-release
CODENAME=$VERSION_CODENAME
sudo tee /etc/apt/sources.list > /dev/null << EOF
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME-backports main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ $CODENAME-security main restricted universe multiverse
EOF
echo "==> 更新软件包列表..."
sudo apt update -qq
echo ""
echo "✅ 清华源更换完成！版本: $CODENAME"
echo "📄 原文件已备份: /etc/apt/sources.list.bak.*"