#!/bin/bash
# Ubuntu 永不休眠配置脚本
# 适用: Ubuntu 18.04+ (GNOME)
set -e
echo "==> 禁用 GNOME 息屏..."
gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
echo "==> 禁用自动挂起..."
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true
echo "==> 禁用锁屏..."
gsettings set org.gnome.desktop.lockdown disable-lock-screen true 2>/dev/null || true
echo "==> 禁用休眠..."
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
echo ""
echo "✅ 永不休眠配置完成！"
echo "💡 如需恢复默认值:"
echo "   gsettings set org.gnome.desktop.session idle-delay 300"
echo "   gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'suspend'"
echo "   gsettings set org.gnome.desktop.lockdown disable-lock-screen false"
