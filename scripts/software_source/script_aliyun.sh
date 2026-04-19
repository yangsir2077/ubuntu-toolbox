#!/bin/bash
# 一键更换为阿里云软件源
set -e
echo "==> 正在备份原软件源..."
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak.$(date +%Y%m%d%H%M%S)
echo "==> 更换为阿里云源..."
sudo tee /etc/apt/sources.list > /dev/null << 'EOF'
deb https://mirrors.aliyun.com/ubuntu/ focal main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-security main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-backports main restricted universe multiverse
EOF
echo "==> 更新软件包列表..."
sudo apt update -qq
echo ""
echo "✅ 阿里云源更换完成！"
echo "📄 原文件已备份: /etc/apt/sources.list.bak.*"
echo "💡 如需恢复: sudo cp /etc/apt/sources.list.bak.* /etc/apt/sources.list && sudo apt update"