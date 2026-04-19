#!/bin/bash
# 端口占用查看与释放
# 用法: ./port_manager.sh [端口号] [操作]
# 操作: view(默认) | kill
PORT="${1:-}"
ACTION="${2:-view}"

if [ -z "$PORT" ]; then
    echo "用法: $0 <端口号> [操作]"
    echo "  操作: view  - 查看端口占用（默认）"
    echo "       kill  - 强制杀死占用进程"
    echo "示例: $0 8080     查看 8080 端口占用"
    echo "示例: $0 8080 kill  杀死 8080 端口占用进程"
    exit 1
fi

echo "==> 查找端口 $PORT 的占用情况..."
RESULT=$(ss -tlnp "sport = :$PORT" 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":$PORT ")
if [ -z "$RESULT" ]; then
    echo "端口 $PORT 当前未被占用"
    exit 0
fi

echo "$RESULT"
echo ""
PID=$(echo "$RESULT" | grep -oP 'pid=\K[0-9]+' | head -1)
PROC=$(echo "$RESULT" | grep -oP 'users:\("\K[^"]+' | head -1)

if [ -n "$PID" ]; then
    echo "进程 PID: $PID"
    echo "进程名: $PROC"
    echo "进程详情:"
    ps -p "$PID" -o user,pid,%cpu,%mem,etime,cmd 2>/dev/null || ps -p "$PID" -f
    echo ""
    if [ "$ACTION" = "kill" ]; then
        echo "==> 正在杀死进程 PID=$PID ..."
        sudo kill -9 "$PID" 2>/dev/null && echo "✅ 进程已强制终止！" || echo "⚠️ 终止失败，请手动检查"
    else
        echo "💡 如需终止进程，运行: sudo kill -9 $PID"
        echo "💡 或使用: $0 $PORT kill"
    fi
else
    echo "⚠️ 无法提取进程信息，请手动检查"
fi