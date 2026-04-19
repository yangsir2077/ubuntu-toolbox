#!/bin/bash
# 一键安装开发基础环境
set -e
echo "==> 更新软件源..."
sudo apt update -qq
echo "==> 安装基础工具..."
sudo apt install -y git curl wget build-essential python3-pip
echo "==> 安装 Node.js (LTS)..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
    sudo apt install -y nodejs
fi
echo "==> 安装 VS Code..."
if ! command -v code &> /dev/null; then
    wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
    sudo install -o root -g root -m 644 /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/
    echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list
    sudo apt update -qq
    sudo apt install -y code
fi
echo ""
echo "✅ 开发环境安装完成！"
echo "📋 已安装: git, curl, wget, build-essential, python3-pip"
echo "📋 已安装: node $(node --version 2>/dev/null || echo '已有')"
echo "📋 已安装: npm $(npm --version 2>/dev/null || echo '已有')"
echo "📋 已安装: VS Code $(code --version 2>/dev/null | head -1 || echo '已有')"
echo ""
echo "💡 提示: 运行 code . 启动 VS Code"