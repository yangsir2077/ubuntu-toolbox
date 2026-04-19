#!/bin/bash
# 系统一键清理脚本
set -e
echo "==> 清理 apt 缓存..."
sudo apt clean
sudo apt autoremove -y
echo "==> 清理旧内核（保留当前内核）..."
CURRENT=$(uname -r)
dpkg -l | grep linux-image | awk '{print $2}' | while read k; do
    if [[ "$k" != "$CURRENT" && "$k" != linux-image-unsigned-* ]]; then
        echo "   卸载旧内核: $k"
        sudo apt purge -y "$k" 2>/dev/null || true
    fi
done
dpkg -l | grep linux-headers | awk '{print $2}' | while read h; do
    if [[ "$h" != *"$CURRENT"* ]]; then
        echo "   卸载旧头文件: $h"
        sudo apt purge -y "$h" 2>/dev/null || true
    fi
done
echo "==> 清理系统日志..."
sudo journalctl --vacuum-size=50M 2>/dev/null || true
echo "==> 清理缩略图缓存..."
rm -rf ~/.cache/thumbnails/* 2>/dev/null || true
echo "==> 清理临时文件..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true
echo ""
echo "✅ 系统清理完成！"
echo "💡 可运行 df -h 查看磁盘使用情况"
echo "💡 如需深度清理，运行: sudo apt autoclean"