#!/bin/bash
# 关闭 Ubuntu 自动更新
set -e
echo "==> 禁用 unattended-upgrades..."
sudo apt remove -y unattended-upgrades 2>/dev/null || true
sudo systemctl disable --now unattended-upgrades 2>/dev/null || true
echo "==> 禁用 apt 自动更新定时器..."
sudo systemctl disable --now apt-daily.timer 2>/dev/null || true
sudo systemctl disable --now apt-daily-upgrade.timer 2>/dev/null || true
echo "==> 设置 apt 不自动下载..."
sudo tee /etc/apt/apt.conf.d/99noupgrade > /dev/null << 'EOF'
APT::Periodic::Enable "0";
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::Unattended-Upgrade "0";
EOF
echo ""
echo "✅ 自动更新已禁用！"
echo "💡 如需恢复，运行:"
echo "   sudo apt install -y unattended-upgrades"
echo "   sudo systemctl enable --now unattended-upgrades"
echo "   sudo rm /etc/apt/apt.conf.d/99noupgrade"