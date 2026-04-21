#!/bin/bash
# 一键安装中文输入法（fcitx5 + fcitx5-pinyin）
# 适用：Ubuntu 20.04 / 22.04
# 作者：Ubuntu 工具箱
set -e

echo "============================================"
echo "  中文输入法安装脚本"
echo "  方案：fcitx5 + fcitx5-pinyin（内置拼音）"
echo "============================================"
echo ""

# ---------- 前置检测 ----------
echo "==> 检查当前输入法框架..."
CURRENT_IM=$(im-config -v 2>/dev/null | grep -oP 'run_im \K\w+' || echo "unknown")
echo "    当前输入法: $CURRENT_IM"

# ---------- 备份当前配置 ----------
echo "==> 备份当前输入法配置..."
BACKUP_DIR="$HOME/.config/fcitx5_backup_$(date +%Y%m%d_%H%M%S)"
if [ -d "$HOME/.config/fcitx5" ]; then
    cp -r "$HOME/.config/fcitx5" "$BACKUP_DIR"
    echo "    备份已保存到: $BACKUP_DIR"
fi

# ---------- 安装 fcitx5 ----------
echo "==> 安装 fcitx5 及依赖..."
sudo apt update -qq
sudo apt install -y fcitx5 fcitx5-chinese-addons fcitx5-config-qt \
    zenity gnome-session xdg-user-dirs xdg-utils im-config

# ---------- 配置 im-config ----------
echo "==> 设置 fcitx5 为系统默认输入法..."
im-config -n fcitx5

# ---------- 配置环境变量（下次登录自动生效）----------
echo "==> 配置环境变量（写入 ~/.xprofile）..."
cat > "$HOME/.xprofile" << 'XPROFILE_EOF'
# fcitx5 环境变量（由 Ubuntu 工具箱自动生成）
export XMODIFIERS=@im=fcitx5
export GTK_IM_MODULE=fcitx5
export QT_IM_MODULE=fcitx5
export CLUTTER_IM_MODULE=fcitx5
XPROFILE_EOF
echo "    已写入 ~/.xprofile"

# ---------- 初始化 fcitx5 配置 ----------
echo "==> 初始化 fcitx5 分组配置..."
mkdir -p "$HOME/.config/fcitx5"

cat > "$HOME/.config/fcitx5/profile" << 'PROFILE_EOF'
[Groups/0]
Name=中文
Default Layout=cn
DefaultIM=pinyin

[Groups/0/Items/0]
Name=keyboard-cn
Layout=

[Groups/0/Items/1]
Name=pinyin
Layout=

[Groups/1]
Name=英文
Default Layout=us
DefaultIM=keyboard-us

[Groups/1/Items/0]
Name=keyboard-us
Layout=

[GroupOrder]
0=中文
1=英文
PROFILE_EOF
echo "    分组配置已写入"

# ---------- 验证安装 ----------
echo ""
echo "==> 验证安装结果..."
MISSING=""
dpkg -l fcitx5 &>/dev/null || MISSING="$MISSING fcitx5"
dpkg -l fcitx5-chinese-addons &>/dev/null || MISSING="$MISSING fcitx5-chinese-addons"

if [ -n "$MISSING" ]; then
    echo "❌ 安装不完整，缺少以下包:$MISSING"
    echo "请运行: sudo apt install -y$MISSING"
    exit 1
fi

echo ""
echo "============================================"
echo "  ✅ 安装完成！"
echo "============================================"
echo ""
echo "📋 下一步操作（必须按顺序执行）："
echo ""
echo "  步骤 1：重启电脑或完全注销后重新登录"
echo "         （必须！否则输入法环境变量不生效）"
echo ""
echo "  步骤 2：登录后在【设置 → 键盘 → 输入法】中"
echo "         确认 fcitx5 已启用，并添加「中文(简体)-拼音」"
echo ""
echo "  步骤 3：按 Ctrl+Space 切换输入法"
echo ""
echo "📝 备选方案（如遇问题）："
echo "    重启后可运行: im-config -n ibus"
echo "    然后注销再登录，恢复原来的 ibus 输入法"
echo ""
echo "📁 配置备份位置: $BACKUP_DIR"
echo "============================================"
