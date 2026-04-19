#!/bin/bash
# Ubuntu 自动登录配置脚本
# 适用: Ubuntu 18.04+ (GDM3)
set -e
bkfile="/etc/gdm3/custom.conf.bak"
curuser=$(whoami)
echo "==> 当前用户: $curuser"
echo "==> 正在备份配置文件..."
sudo cp /etc/gdm3/custom.conf "$bkfile" 2>/dev/null || true
echo "==> 配置自动登录..."
sudo sed -i 's/^# *AutomaticLoginEnable.*/AutomaticLoginEnable=true/' /etc/gdm3/custom.conf
sudo sed -i 's/^# *AutomaticLogin.*/AutomaticLogin='"$curuser"'/' /etc/gdm3/custom.conf
sudo sed -i 's/^AutomaticLoginEnable=.*/AutomaticLoginEnable=true/' /etc/gdm3/custom.conf
sudo sed -i 's/^AutomaticLogin=.*/AutomaticLogin='"$curuser"'/' /etc/gdm3/custom.conf
if ! grep -q "AutomaticLoginEnable=true" /etc/gdm3/custom.conf; then
    echo 'AutomaticLoginEnable=true' | sudo tee -a /etc/gdm3/custom.conf > /dev/null
fi
if ! grep -q "AutomaticLogin=$curuser" /etc/gdm3/custom.conf; then
    echo "AutomaticLogin=$curuser" | sudo tee -a /etc/gdm3/custom.conf > /dev/null
fi
echo ""
echo "✅ 自动登录已配置！用户: $curuser"
echo "📄 备份文件: $bkfile"
echo "🔄 重启后生效: sudo reboot"