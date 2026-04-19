#!/bin/bash
# 一键更换为中国科学技术大学软件源
set -e
echo "==> 正在备份原软件源..."
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)
echo "==> 更换为中科大源..."
. /etc/os-release
CODENAME=$VERSION_CODENAME
sudo tee /etc/apt/sources.list > /dev/null << EOF
deb https://mirrors.ustc.edu.cn/ubuntu/ $CODENAME main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ $CODENAME-updates main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ $CODENAME-backports main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ $CODENAME-security main restricted universe multiverse
EOF
echo "==> 更新软件包列表..."
sudo apt update -qq
echo ""
echo "✅ 中科大源更换完成！版本: $CODENAME"
echo "📄 原文件已备份: /etc/apt/sources.list.bak.*"