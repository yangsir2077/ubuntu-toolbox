#!/bin/bash
# ================================================
# Ubuntu 自动更新管理
# 适用: Ubuntu 18.04 及以上
# ================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "╔══════════════════════════════════════╗"
echo "║     Ubuntu 自动更新管理              ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "请选择操作："
echo "  1) 关闭自动更新（禁用后台自动更新）"
echo "  2) 开启自动更新（恢复默认）"
echo ""
read -p "请输入选项 [1-2]: " choice

case "$choice" in
    2)
        echo "==> 正在恢复自动更新设置..."
        sudo apt install -y unattended-upgrades 2>/dev/null || true
        sudo systemctl enable --now unattended-upgrades 2>/dev/null || true
        sudo systemctl enable --now apt-daily.timer 2>/dev/null || true
        sudo systemctl enable --now apt-daily-upgrade.timer 2>/dev/null || true
        sudo rm -f /etc/apt/apt.conf.d/99noupgrade
        echo "✅ 自动更新已恢复！"
        ;;
    *)
        bash "$SCRIPT_DIR/script_disable.sh"
        ;;
esac
