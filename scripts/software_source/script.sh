#!/bin/bash
# ================================================
# Ubuntu 软件源一键切换（交互式选择）
# 适用: Ubuntu 全版本
# ================================================
echo "╔══════════════════════════════════════╗"
echo "║     Ubuntu 软件源切换工具            ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "请选择要切换的软件源："
echo "  1) 阿里云镜像（推荐，国内速度快）"
echo "  2) 清华大学镜像"
echo "  3) 中国科学技术大学镜像"
echo ""
read -p "请输入选项 [1-3] (默认1): " choice
choice="${choice:-1}"

case "$choice" in
    2) SCRIPT_URL="https://mirrors.tuna.tsinghua.edu.cn/help/ubuntu" ;;
    3) SCRIPT_URL="https://mirrors.ustc.edu.cn/help/ubuntu" ;;
    *) SCRIPT_URL="aliyun" ;;
esac

# 动态执行对应脚本
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$choice" in
    2) bash "$SCRIPT_DIR/script_tsinghua.sh" ;;
    3) bash "$SCRIPT_DIR/script_ustc.sh" ;;
    *) bash "$SCRIPT_DIR/script_aliyun.sh" ;;
esac
