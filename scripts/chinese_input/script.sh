#!/bin/bash
# 一键安装中文输入法（搜狗输入法 / 谷歌拼音）
set -e
CHOICE="${1:-sogou}"

echo "==> 安装中文输入法..."
echo "==> 选项: $CHOICE (sogou=搜狗, google=谷歌拼音)"
echo ""

# 安装 fcitx5 和基础依赖
echo "==> 安装 fcitx5 及依赖..."
sudo apt install -y fcitx5 fcitx5-chinese-addons fcitx5-config-qt     zenity gnome-session xdg-user-dirs xdg-utils im-config || true

echo "==> 设置 fcitx5 为默认输入法框架..."
im-config -n fcitx || echo "⚠️ im-config 设置失败，请手动运行 im-config"

# 搜狗输入法
install_sogou() {
    echo "==> 安装搜狗输入法..."
    echo "deb [trusted=yes] https://ime.sogoucdn.com/ ./" | sudo tee /etc/apt/sources.list.d/sogou.list > /dev/null
    wget -qO /tmp/sogoupinyin.deb https://ime.sogoupinyin.com/ubuntu/pool/main/s/sogoupinyin/sogoupinyin_*.deb 2>/dev/null ||     wget -qO /tmp/sogoupinyin.deb https://github.com/im下地亩/SogouIME_ubuntu/raw/master/sogoupinyin_2.7.0.1718_amd64.deb
    sudo apt install -y /tmp/sogoupinyin.deb || echo "⚠️ 搜狗安装失败，尝试其他版本..."
    rm -f /tmp/sogoupinyin.deb
}

# 谷歌拼音
install_google() {
    echo "==> 安装谷歌拼音..."
    sudo apt install -y fcitx5-googlepinyin || echo "⚠️ 谷歌拼音安装失败"
}

if [ "$CHOICE" = "google" ]; then
    install_google
else
    install_sogou || install_google
fi

echo ""
echo "✅ 中文输入法安装完成！"
echo "💡 请注销并重新登录，然后在输入法设置中添加搜狗/谷歌拼音"
echo "💡 快捷键 Ctrl+Space 切换输入法"
echo "⚠️ 如果输入法不生效，运行: fcitx5 &"