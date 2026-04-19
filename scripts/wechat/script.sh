#!/bin/bash
# Ubuntu 安装微信
set -e

install_electronic_wechat() {
    echo "==> 安装 Snapd (如未安装)..."
    if ! command -v snap &>/dev/null; then
        sudo apt install -y snapd
        sudo systemctl enable --now snapd.socket snapd.apparmor
    fi
    
    echo "==> 安装 electronic-wechat (Snap)..."
    # 先移除旧版本（如有）
    sudo snap remove electronic-wechat 2>/dev/null || true
    sudo snap install electronic-wechat --classic
    
    echo ""
    echo "✅ 微信安装完成！"
    echo "启动方式: snap run electronic-wechat"
    echo "或在下拉菜单中搜索 'WeChat' / 'electronic-wechat'"
    echo ""
    echo "💡 常见问题:"
    echo "   - 托盘图标不显示: 安装 GNOME Tray Icons: Reloaded 扩展"
    echo "   - 无法截图: sudo snap connect electronic-wechat :wayland 或 :x11"
}

echo "==> 选择安装方式..."
echo "1) Snap 版 electronic-wechat (推荐，维护中)"
echo "2) 尝试修复 Deepin Wine 源"
echo ""

read -p "请选择 [1]: " choice
choice=${choice:-1}

if [ "$choice" = "2" ]; then
    echo "==> 尝试修复 Deepin Wine 源..."
    # 清理旧源
    sudo rm -f /etc/apt/sources.list.d/deepin-wine.i-m.dev.list
    sudo rm -f /etc/apt/preferences.d/deepin-wine.i-m.dev.pref
    sudo rm -f /etc/profile.d/deepin-wine.i-m.dev.sh
    
    # 尝试使用社区镜像 (如果主源恢复)
    echo "deb [trusted=yes] https://deepin-wine.i-m.dev /" | sudo tee /etc/apt/sources.list.d/deepin-wine.i-m.dev.list
    
    echo "==> 更新软件源..."
    sudo apt update -qq 2>&1 | grep -v "^命中" | grep -E "(错误|404|无法)" && {
        echo ""
        echo "❌ Deepin Wine 源仍然不可用，将改用 Snap 方案..."
        install_electronic_wechat
        exit 0
    }
    
    echo "==> 安装微信..."
    sudo apt install -y com.qq.weixin.deepin 2>/dev/null && {
        echo ""
        echo "✅ 微信安装完成！在应用菜单搜索 'WeChat' 启动"
    } || {
        echo "❌ apt 安装失败，改用 Snap 方案..."
        install_electronic_wechat
    }
else
    install_electronic_wechat
fi
