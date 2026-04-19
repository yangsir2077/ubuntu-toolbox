#!/bin/bash
# SSH 远程登录一键开启/关闭
ACTION="${1:-status}"

echo "==> SSH 服务管理: $ACTION"
echo ""

show_status() {
    if systemctl is-active --quiet ssh 2>/dev/null || systemctl is-active --quiet sshd 2>/dev/null; then
        echo "🟢 SSH 服务状态: 已开启"
    else
        echo "🔴 SSH 服务状态: 未开启"
    fi
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    echo "📡 本机 IP: ${IP:-无法获取}"
}

case "$ACTION" in
    on|enable|start)
        echo "==> 安装 openssh-server..."
        sudo apt update -qq
        sudo apt install -y openssh-server
        echo "==> 启动 SSH 服务..."
        sudo systemctl enable --now ssh
        sudo systemctl enable --now sshd 2>/dev/null || true
        show_status
        echo ""
        echo "✅ SSH 已开启！"
        echo "💡 连接方式: ssh {USER}@$(hostname -I | awk '{print $1}')"
        ;;
    off|disable|stop)
        echo "==> 停止 SSH 服务..."
        sudo systemctl stop ssh sshd 2>/dev/null || true
        sudo systemctl disable ssh sshd 2>/dev/null || true
        show_status
        echo "✅ SSH 已关闭"
        ;;
    *)
        show_status
        echo ""
        echo "用法: $0 [on|off]"
        echo "  $0 on   - 开启 SSH"
        echo "  $0 off  - 关闭 SSH"
        ;;
esac