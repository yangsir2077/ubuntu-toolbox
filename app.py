#!/usr/bin/env python3
"""
Ubuntu 工具箱 - Flask Web 可视化工具
=====================================
模块化设计：scripts/ 目录下每个子目录 = 一个功能模块
新增模块：只需添加脚本文件 + 在 MODULE_REGISTRY 注册
"""

from flask import Flask, render_template, request, jsonify, send_file
import os, re, subprocess, zipfile, tempfile, shutil

app = Flask(__name__)
APP_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.join(APP_DIR, "scripts")

# ================================================================
# 模块注册表
# ================================================================
# 字段说明：
#   dir      - scripts/ 下的子目录名
#   versions - 支持的 Ubuntu 大版本列表（留空=不限版本）
#   cronable - 是否支持定时执行
# ================================================================
MODULE_REGISTRY = {
    "wechat": {
        "name": "微信 (WeChat)", "name_en": "WeChat",
        "icon": "💬",
        "description": "通过 Deepin Wine 兼容层在 Ubuntu 上安装微信",
        "os": "Ubuntu 20.04 / 22.04 / 24.04",
        "instructions": [
            "系统要求：Ubuntu 20.04 及以上版本",
            "使用 Deepin Wine 技术实现微信运行",
            "安装后可在应用列表找到微信",
            "首次运行需要配置 wine 目录",
        ],
        "preview_text": "脚本执行后，可在 Ubuntu 应用列表中找到并打开微信，支持消息收发。首次启动会自动配置 wine 目录。",
        "dir": "wechat",
        "versions": ["20.04", "22.04", "24.04"],
        "cronable": False,
    },
    "qq": {
        "name": "QQ", "name_en": "QQ",
        "icon": "🐧",
        "description": "通过 Deepin Wine 兼容层在 Ubuntu 上安装 QQ",
        "os": "Ubuntu 20.04 / 22.04 / 24.04",
        "instructions": [
            "系统要求：Ubuntu 20.04 及以上版本",
            "使用 Deepin Wine 技术实现 QQ 运行",
            "安装后可在应用列表找到 QQ",
            "支持消息、群聊、文件传输等基础功能",
        ],
        "preview_text": "脚本执行后，可在 Ubuntu 应用列表中找到并打开 QQ，支持单聊、群聊、文件传输等基础功能。",
        "dir": "qq",
        "versions": ["20.04", "22.04", "24.04"],
        "cronable": False,
    },
    "auto_login": {
        "name": "自动登录配置", "name_en": "Auto Login",
        "icon": "🔐",
        "description": "配置 Ubuntu 自动登录，无需输入密码即可进入桌面",
        "os": "Ubuntu 18.04 及以上 (GDM3)",
        "instructions": [
            "⚠️ 此操作修改系统认证配置，请谨慎使用",
            "适用于单用户设备，多用户设备建议设置短密码",
            "需要 sudo 权限执行",
            "操作前建议备份: sudo cp /etc/gdm3/custom.conf /etc/gdm3/custom.conf.bak",
        ],
        "preview_text": "脚本执行后，Ubuntu 开机将自动登录到当前用户桌面，无需输入密码。重启后生效。",
        "dir": "auto_login",
        "versions": [],   # 所有版本通用
        "cronable": True,
    },
    "no_sleep": {
        "name": "永不休眠配置", "name_en": "No Sleep",
        "icon": "☀️",
        "description": "阻止 Ubuntu 息屏、挂起和休眠，保持屏幕常亮",
        "os": "Ubuntu 18.04 及以上 (GNOME)",
        "instructions": [
            "通过 gsettings 修改 GNOME 电源管理配置",
            "禁用息屏、挂起、休眠、超时锁定",
            "立即生效，无需重启",
            "支持 Wayland 和 X11 会话",
        ],
        "preview_text": "脚本执行后，Ubuntu 将保持屏幕常亮，不会息屏、挂起或休眠。立即生效，重启后需重新运行。",
        "dir": "no_sleep",
        "versions": [],   # 所有版本通用
        "cronable": True,
    },
    "software_source": {
        "name": "更换国内软件源", "name_en": "Software Source",
        "icon": "🔄",
        "description": "一键切换阿里云/清华/中科大源，解决 apt 下载慢、更新失败问题",
        "os": "Ubuntu 全版本",
        "instructions": [
            "支持阿里云、清华、中科大三大镜像源",
            "自动备份原 sources.list 文件",
            "切换后自动执行 apt update",
            "如遇问题可从备份文件恢复",
        ],
        "preview_text": "脚本执行后，apt 软件源将切换为国内镜像，下载速度大幅提升。",
        "dir": "software_source",
        "versions": [],
        "cronable": False,
    },
    "dev_env": {
        "name": "开发基础环境", "name_en": "Dev Environment",
        "icon": "🛠️",
        "description": "一键安装 git、curl、wget、build-essential、python3-pip、nodejs、npm、vscode",
        "os": "Ubuntu 20.04 / 22.04 / 24.04",
        "instructions": [
            "批量安装开发常用工具（git、curl、wget 等）",
            "安装 Node.js LTS 版本",
            "安装 VS Code 编辑器",
            "适用于新装 Ubuntu 后快速搭建开发环境",
        ],
        "preview_text": "脚本执行后，将自动安装开发必备工具：Git、Node.js、npm、VS Code、Python pip 等，一次配齐。",
        "dir": "dev_env",
        "versions": [],
        "cronable": False,
    },
    "system_cleanup": {
        "name": "系统清理", "name_en": "System Cleanup",
        "icon": "🧹",
        "description": "清理 apt 缓存、旧内核、无用依赖、系统日志、缩略图，释放磁盘空间",
        "os": "Ubuntu 全版本",
        "instructions": [
            "清理 apt 缓存和不再需要的依赖包",
            "卸载旧内核（保留当前使用的内核）",
            "清理系统日志（限制在 50MB）",
            "清理缩略图缓存和临时文件",
        ],
        "preview_text": "脚本执行后，自动清理旧内核、apt 缓存、系统日志、缩略图等无用文件，释放磁盘空间。",
        "dir": "system_cleanup",
        "versions": [],
        "cronable": True,
    },
    "auto_update": {
        "name": "关闭系统自动更新", "name_en": "Disable Auto Update",
        "icon": "🚫",
        "description": "禁用 Ubuntu 后台自动更新和自动下载，避免突然卡顿或强制重启",
        "os": "Ubuntu 18.04 及以上",
        "instructions": [
            "卸载 unattended-upgrades 组件",
            "禁用 apt 每日自动更新定时器",
            "设置 apt 不自动下载更新",
            "不影响手动 apt upgrade",
        ],
        "preview_text": "脚本执行后，Ubuntu 将不再自动下载和安装更新，避免工作或演示时突然卡顿或重启。",
        "dir": "auto_update",
        "versions": [],
        "cronable": False,
    },
    "port_manager": {
        "name": "端口管理", "name_en": "Port Manager",
        "icon": "🔌",
        "description": "输入端口号查看占用进程，一键杀死进程，释放端口",
        "os": "Ubuntu 全版本",
        "instructions": [
            "查看指定端口（如 8080）的占用进程",
            "显示进程 PID、CPU/内存占用、运行时长",
            "支持强制杀死进程（kill -9）",
            "查看本机所有监听端口",
        ],
        "preview_text": "脚本执行后，输入端口号即可查看占用该端口的进程信息，支持一键杀死进程，适合开发时端口冲突解决。",
        "dir": "port_manager",
        "versions": [],
        "cronable": False,
    },
    "chinese_input": {
        "name": "安装中文输入法", "name_en": "Chinese Input",
        "icon": "⌨️",
        "description": "一键安装 fcitx5 + fcitx5-pinyin（内置拼音），解决 Ubuntu 无中文输入的问题",
        "os": "Ubuntu 20.04 / 22.04",
        "instructions": [
            "安装 fcitx5 输入法框架和 fcitx5-chinese-addons",
            "自动配置 im-config 和 ~/.xprofile 环境变量",
            "初始化 fcitx5 分组（中文/英文键盘）",
            "⚠️ 装完后必须【注销并重新登录】才能生效",
            "如遇问题可运行 im-config -n ibus 恢复原输入法",
        ],
        "preview_text": "脚本执行后，自动安装 fcitx5 中文拼音输入法。注销重新登录后，按 Ctrl+Space 切换中/英文输入。",
        "dir": "chinese_input",
        "versions": [],
        "cronable": False,
    },
    "ssh_manager": {
        "name": "SSH 远程管理", "name_en": "SSH Manager",
        "icon": "🖥️",
        "description": "一键开启/关闭 SSH 远程登录，显示本机 IP，方便远程连接",
        "os": "Ubuntu 全版本",
        "instructions": [
            "安装并启动 openssh-server",
            "一键开启/关闭 SSH 服务",
            "显示本机局域网 IP 地址",
            "设置开机自启动",
        ],
        "preview_text": "脚本执行后，SSH 服务将启动，显示本机 IP 地址，可通过 ssh username@IP 从其他设备远程连接。",
        "dir": "ssh_manager",
        "versions": [],
        "cronable": False,
    },

}

# ================================================================
# 脚本文件读取 + 占位符替换
# 占位符规范（脚本文件中使用）：
#   {CUR_USER}  -> $(whoami)   动态获取当前用户名
#   {HOME_DIR}  -> (运行时替换)    当前用户家目录
# ================================================================
PLACEHOLDER_MAP = {
    "{CUR_USER}": "$(whoami)",
    '{HOME_DIR}': '$home',
}


def read_script(module_id: str, version: str = "") -> str:
    """
    读取脚本文件内容，并替换占位符为正确的 shell 变量。
    version 为空时读取通用脚本，否则读取版本专属脚本。
    """
    mod = MODULE_REGISTRY.get(module_id)
    if not mod:
        return ""

    base = os.path.join(SCRIPTS_DIR, mod["dir"])

    if version and version in (mod.get("versions") or []):
        # 优先找版本专属脚本
        script_path = os.path.join(base, f"script_{version}.sh")
        if not os.path.exists(script_path):
            script_path = os.path.join(base, "script.sh")

        # 如果找不到版本专属脚本，读取通用脚本
        if not os.path.exists(script_path):
            script_path = os.path.join(base, "script.sh")
    else:
        script_path = os.path.join(base, "script.sh")

    if not os.path.exists(script_path):
        return f"# 脚本文件不存在: {script_path}\n# 请在 scripts/{mod['dir']}/ 目录下创建 script.sh"

    content = open(script_path, encoding="utf-8").read()

    # 替换占位符为真实 shell 变量
    for ph, val in PLACEHOLDER_MAP.items():
        content = content.replace(ph, val)

    return content


def ensure_scripts():
    """确保 scripts/ 目录结构存在，不存在则自动创建占位文件"""
    for mod_id, mod in MODULE_REGISTRY.items():
        dir_path = os.path.join(SCRIPTS_DIR, mod["dir"])
        os.makedirs(dir_path, exist_ok=True)

        script_path = os.path.join(dir_path, "script.sh")
        if not os.path.exists(script_path):
            _create_default_script(mod_id, mod, script_path)

        # 为有版本支持的模块创建版本专属脚本
        for ver in (mod.get("versions") or []):
            ver_path = os.path.join(dir_path, f"script_{ver}.sh")
            if not os.path.exists(ver_path):
                _create_default_script(mod_id, mod, ver_path, version=ver)


def _create_default_script(mod_id, mod, path, version=""):
    """为模块创建默认脚本文件"""
    name = mod["name_en"].replace(" ", "_").lower()

    defaults = {
        "wechat": {
            "通用": _SCRIPT_WE,
            "20.04": _SCRIPT_WE,
            "22.04": _SCRIPT_WE,
            "24.04": _SCRIPT_WE_24,
        },
        "qq": {
            "通用": _SCRIPT_QQ,
            "20.04": _SCRIPT_QQ,
            "22.04": _SCRIPT_QQ,
            "24.04": _SCRIPT_QQ_24,
        },
        "auto_login": {"通用": _SCRIPT_LOGIN, "20.04": _SCRIPT_LOGIN, "22.04": _SCRIPT_LOGIN, "24.04": _SCRIPT_LOGIN},
        "no_sleep":   {"通用": _SCRIPT_SLEEP, "20.04": _SCRIPT_SLEEP, "22.04": _SCRIPT_SLEEP, "24.04": _SCRIPT_SLEEP_24},
    }

    key = version if version else "通用"
    content = defaults.get(mod_id, {}).get(key, defaults.get(mod_id, {}).get("通用", ""))

    # 写入文件（写入时用占位符，不做替换）
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ================================================================
# 默认脚本内容（写入文件时使用占位符，运行时替换）
# ================================================================
_SCRIPT_WE = """#!/bin/bash
# Ubuntu 安装微信 (Deepin Wine 方案)
set -e
echo "==> 更新软件源..."
sudo apt update -qq
echo "==> 安装依赖包..."
sudo apt install -y wget gnome-terminal wine64 gnupg2 curl
echo "==> 添加 Deepin Wine 源..."
wget -qO- https://deepin-wine.i-m.dev/apt/gpg.key | sudo tee /etc/apt/trusted.gpg.d/deepin-wine.gpg > /dev/null
echo "deb [trusted=yes] https://deepin-wine.i-m.dev/apt/ unstable main" | sudo tee /etc/apt/sources.list.d/deepin-wine.list
echo "==> 安装微信..."
sudo apt update -qq
sudo apt install -y deepin.com.wechat2
echo ""
echo "✅ 微信安装完成！在应用菜单搜索 'WeChat' 启动"
echo "💡 如启动失败: sudo apt install -y deepin-wine6-stable"
"""

_SCRIPT_WE_24 = """#!/bin/bash
# Ubuntu 24.04 安装微信（可能需要额外依赖）
set -e
echo "==> 更新软件源..."
sudo apt update -qq
echo "==> 安装依赖包（含 24.04 额外依赖）..."
sudo apt install -y wget gnome-terminal wine64 gnupg2 curl libc6-dev libncurses6
echo "==> 添加 Deepin Wine 源..."
wget -qO- https://deepin-wine.i-m.dev/apt/gpg.key | sudo tee /etc/apt/trusted.gpg.d/deepin-wine.gpg > /dev/null
echo "deb [trusted=yes] https://deepin-wine.i-m.dev/apt/ unstable main" | sudo tee /etc/apt/sources.list.d/deepin-wine.list
echo "==> 安装微信..."
sudo apt update -qq
sudo apt install -y deepin.com.wechat2 || echo "⚠️ 如安装失败请检查兼容性"
echo ""
echo "✅ 微信安装完成！在应用菜单搜索 'WeChat' 启动"
"""

_SCRIPT_QQ = """#!/bin/bash
# Ubuntu 安装 QQ (Deepin Wine 方案)
set -e
echo "==> 更新软件源..."
sudo apt update -qq
echo "==> 安装依赖包..."
sudo apt install -y wget gnome-terminal wine64 gnupg2 curl
echo "==> 添加 Deepin Wine 源..."
wget -qO- https://deepin-wine.i-m.dev/apt/gpg.key | sudo tee /etc/apt/trusted.gpg.d/deepin-wine.gpg > /dev/null
echo "deb [trusted=yes] https://deepin-wine.i-m.dev/apt/ unstable main" | sudo tee /etc/apt/sources.list.d/deepin-wine.list
echo "==> 安装 QQ..."
sudo apt update -qq
sudo apt install -y deepin.com.qq.im
echo ""
echo "✅ QQ 安装完成！在应用菜单搜索 'QQ' 启动"
echo "💡 如启动失败: sudo apt install -y deepin-wine6-stable"
"""

_SCRIPT_QQ_24 = """#!/bin/bash
# Ubuntu 24.04 安装 QQ（可能需要额外依赖）
set -e
echo "==> 更新软件源..."
sudo apt update -qq
echo "==> 安装依赖包（含 24.04 额外依赖）..."
sudo apt install -y wget gnome-terminal wine64 gnupg2 curl libc6-dev
echo "==> 添加 Deepin Wine 源..."
wget -qO- https://deepin-wine.i-m.dev/apt/gpg.key | sudo tee /etc/apt/trusted.gpg.d/deepin-wine.gpg > /dev/null
echo "deb [trusted=yes] https://deepin-wine.i-m.dev/apt/ unstable main" | sudo tee /etc/apt/sources.list.d/deepin-wine.list
echo "==> 安装 QQ..."
sudo apt update -qq
sudo apt install -y deepin.com.qq.im || echo "⚠️ 如安装失败请检查兼容性"
echo ""
echo "✅ QQ 安装完成！在应用菜单搜索 'QQ' 启动"
"""

_SCRIPT_LOGIN = """#!/bin/bash
# Ubuntu 自动登录配置脚本
# 适用: Ubuntu 18.04+ (GDM3)
set -e
BKFILE="/etc/gdm3/custom.conf.bak"
# 动态获取当前用户名，不要硬编码
CURUSER={CUR_USER}
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
"""

_SCRIPT_SLEEP = """#!/bin/bash
# Ubuntu 永不休眠配置脚本
# 适用: Ubuntu 18.04+ (GNOME)
set -e
echo "==> 禁用 GNOME 息屏..."
gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
echo "==> 禁用自动挂起..."
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true
echo "==> 禁用锁屏..."
gsettings set org.gnome.desktop.lockdown disable-lock-screen true 2>/dev/null || true
echo "==> 禁用休眠..."
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
echo ""
echo "✅ 永不休眠配置完成！"
echo "💡 如需恢复默认值:"
echo "   gsettings set org.gnome.desktop.session idle-delay 300"
echo "   gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'suspend'"
echo "   gsettings set org.gnome.desktop.lockdown disable-lock-screen false"
"""

_SCRIPT_SLEEP_24 = """#!/bin/bash
# Ubuntu 24.04 永不休眠配置脚本（GNOME 46+ 兼容）
set -e
echo "==> 禁用 GNOME 息屏..."
gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
echo "==> 禁用自动挂起..."
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true
echo "==> 禁用锁屏..."
gsettings set org.gnome.desktop.lockdown disable-lock-screen true 2>/dev/null || true
echo "==> 禁用休眠..."
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
echo ""
echo "✅ 永不休眠配置完成！"
echo "💡 如需恢复默认值:"
echo "   gsettings set org.gnome.desktop.session idle-delay 300"
echo "   gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'suspend'"
echo "   gsettings set org.gnome.desktop.lockdown disable-lock-screen false"
"""


# ================================================================
# 启动时初始化脚本文件
# ================================================================
with app.app_context():
    ensure_scripts()


# ================================================================
# 路由
# ================================================================

@app.route('/')
def index():
    return render_template("index.html", module_registry=MODULE_REGISTRY)


# ---------- Electron 渲染层脚本（桌面版注入） ----------
@app.route('/electron/electron.js')
def serve_electron_js():
    """Electron 桌面版专用渲染层脚本"""
    # 尝试多个可能路径
    paths_to_try = [
        os.path.join(APP_DIR, 'electron', 'src', 'renderer', 'electron.js'),
        os.path.join(APP_DIR, 'resources', 'app', 'src', 'renderer', 'electron.js'),
    ]
    for p in paths_to_try:
        if os.path.exists(p):
            return send_file(p, mimetype='application/javascript')
    return "// Electron renderer not found", 404


# ---------- 获取脚本（支持版本） ----------
@app.route('/api/script/<script_id>')
def get_script(script_id):
    if script_id not in MODULE_REGISTRY:
        return jsonify({"error": "脚本不存在"}), 404

    mod = MODULE_REGISTRY[script_id]
    version = request.args.get('version', '').strip()

    # 读取脚本（自动做占位符替换）
    script_content = read_script(script_id, version)

    return jsonify({
        "name": mod["name"],
        "name_en": mod["name_en"],
        "icon": mod["icon"],
        "description": mod["description"],
        "os": mod["os"],
        "instructions": mod["instructions"],
        "script": script_content,
        "preview": {"text": mod.get("preview_text", "")},
        "versions": mod.get("versions", []),
        "has_versions": bool(mod.get("versions")),
        "cronable": mod.get("cronable", False),
    })


# ---------- 执行/预览 ----------
@app.route('/api/execute', methods=['POST'])
def execute_script():
    data = request.json or {}
    sid = data.get('script_id')
    if sid not in MODULE_REGISTRY:
        return jsonify({"error": "脚本不存在"}), 404
    version = data.get('version', '').strip()
    return jsonify({
        "success": True,
        "script": read_script(sid, version),
        "message": "脚本已准备好，请在终端中以 sudo 权限运行。",
    })


# ---------- 下载单个脚本 ----------
@app.route('/api/download/script/<script_id>')
def download_script(script_id):
    if script_id not in MODULE_REGISTRY:
        return jsonify({"error": "脚本不存在"}), 404

    mod = MODULE_REGISTRY[script_id]
    version = request.args.get('version', '').strip()
    fname = f"{mod['name_en'].lower().replace(' ', '_')}_{version or 'all'}_install.sh"
    content = read_script(script_id, version)

    return jsonify({"filename": fname, "content": content, "message": "请复制脚本内容到终端执行"}), 200


# ---------- 功能二：自动检测本机 Ubuntu 版本 ----------
@app.route('/api/detect_my_version')
def detect_my_version():
    """
    在服务器上运行 lsb_release -rs，获取真实 Ubuntu 版本。
    自动提取大版本号（如 22.04.1 -> 22.04）。
    """
    try:
        result = subprocess.check_output(
            ["lsb_release", "-rs"],
            text=True, stderr=subprocess.DEVNULL
        )
        raw_version = result.strip()  # 例如 "22.04.1"
    except Exception:
        return jsonify({
            "raw": None,
            "major": None,
            "error": "无法检测 Ubuntu 版本（请手动输入）",
        })

    # 提取大版本号：22.04.1 -> 22.04
    m = re.match(r'^(\d+\.\d+)', raw_version)
    major = m.group(1) if m else raw_version

    # 判断支持情况
    all_supported = {"18.04", "20.04", "22.04", "24.04"}
    supported = major in all_supported

    # 推荐模块：只要版本 >= 18.04 所有模块都支持
    recommended = list(MODULE_REGISTRY.keys()) if major >= "18.04" else []

    return jsonify({
        "raw": raw_version,
        "major": major,
        "supported": supported,
        "recommended": recommended,
        "message": f"检测到 Ubuntu {major}，" + (
            "所有模块均可使用。" if supported
            else f"部分模块可能存在兼容性问题。"
        ),
    })


# ---------- 功能二：用户手动输入版本 ----------
@app.route('/api/detect_version', methods=['POST'])
def detect_version():
    """用户手动输入版本号，自动归一化到大版本并推荐模块"""
    data = request.json or {}
    version = data.get('version', '').strip()

    if not version:
        return jsonify({"error": "请提供 Ubuntu 版本号"}), 400

    # 提取大版本
    m = re.match(r'^(\d+)\.(\d+)', version)
    if not m:
        return jsonify({"error": "版本号格式不正确，请输入类似 22.04 的格式"}), 400

    major = f"{m.group(1)}.{m.group(2)}"
    all_supported = {"18.04", "20.04", "22.04", "24.04"}
    supported = major in all_supported
    recommended = list(MODULE_REGISTRY.keys()) if major >= "18.04" else []

    return jsonify({
        "version": major,
        "supported": supported,
        "recommended": recommended,
        "message": f"Ubuntu {major}，" + ("所有模块均可使用。" if supported else "部分模块可能存在兼容性问题。"),
    })


# ---------- 功能三：日志解析 ----------
ERROR_RULES = [
    (r"permission denied|sudo:\s*permission denied", "error", "权限不足",
     "请在命令前加上 sudo，使用管理员权限执行，例如：sudo apt install ..."),
    (r"command not found|Command not found|bash:\s+\w+:\s+command not found", "error", "命令不存在",
     "请先安装对应工具：sudo apt install <软件包名>"),
    (r"connection refused|ECONNREFUSED|Unable to connect", "error", "连接被拒绝",
     "请检查网络连接和服务状态，确认目标服务已启动（systemctl start <服务名>）"),
    (r"404\s+Not Found|404\s+找不到|HTTP Error 404", "error", "资源不存在（404）",
     "软件源地址已变更，请访问官方文档获取最新安装源"),
    (r"gpg(?:key)?.*error|GPG.*error|公钥.*错误", "error", "GPG 密钥错误",
     "请重新导入 GPG 公钥，或使用 wget/curl 手动下载后导入"),
    (r"timeout|连接超时|download.*timeout", "error", "下载超时",
     "网络不稳定，请检查网络，或更换为国内镜像源（清华/阿里/中科大）"),
    (r"no space left|磁盘空间不足|device full", "error", "磁盘空间不足",
     "清理磁盘：df -h 查看，du -sh * 定位大文件，apt autoremove 清理缓存"),
    (r"already exists|文件已存在|already installed", "warning", "已安装或已存在",
     "该软件包已安装，如需重新安装请先卸载：sudo apt remove <包名>"),
    (r"dependency.*problem|依赖.*问题|has dependency issues", "warning", "依赖关系问题",
     "运行 sudo apt -f install 自动修复依赖，或手动安装缺失的依赖包"),
    (r"wine.* Segmentation fault|WINE.*fault|deepin.*fault", "error", "Wine 兼容层崩溃",
     "Deepin Wine 在此 Ubuntu 版本上可能有兼容问题，建议尝试安装 deepin-wine6-stable"),
    (r"Could not get lock|锁文件.*被占用|apt.*lock", "warning", "软件包管理器被锁定",
     "另一个 apt 进程正在运行，等待其完成或运行 sudo killall apt apt-get 后重试"),
    (r"authentication failure|认证失败|password.*fail", "error", "认证失败",
     "请确认输入的密码正确，注意 sudo 密码输入时无回显是正常的"),
    (r"is not in the sudoers file|不在 sudoers 中", "error", "当前用户没有 sudo 权限",
     "请切换到有 sudo 权限的用户执行此操作，或联系系统管理员"),
    (r"package.*has no installation candidate|没有可安装的候选", "error", "找不到可用包",
     "软件源中不包含此包，可能需要添加第三方源或使用其他安装方式"),
    (r"failed to fetch|无法获取|download failed", "error", "下载失败",
     "软件源连接失败，请检查网络或更换为国内镜像源"),
]


@app.route('/api/parse_log', methods=['POST'])
def parse_log():
    data = request.json or {}
    log_text = data.get('log', '')
    if not log_text.strip():
        return jsonify({"error": "请粘贴终端日志内容"}), 400

    results = []
    seen = set()

    for pattern, severity, error_desc, solution in ERROR_RULES:
        if re.search(pattern, log_text, re.IGNORECASE | re.MULTILINE):
            if error_desc not in seen:
                seen.add(error_desc)
                match_line = next(
                    (l.strip() for l in log_text.splitlines()
                     if re.search(pattern, l, re.IGNORECASE)), ""
                )
                results.append({
                    "severity": severity,
                    "error": error_desc,
                    "matched_line": match_line,
                    "solution": solution,
                })

    if not results:
        results.append({
            "severity": "info",
            "error": "未识别到已知错误",
            "matched_line": "",
            "solution": "日志中没有检测到常见错误模式。请手动检查终端输出，或尝试搜索引擎搜索错误信息。",
        })

    return jsonify({"total": len(results), "results": results})


# ---------- 功能四：Cron 任务生成 ----------
CRON_SUPPORTED = [sid for sid, m in MODULE_REGISTRY.items() if m.get("cronable")]


@app.route('/api/gen_cron', methods=['POST'])
def gen_cron():
    data = request.json or {}
    script_id = data.get('script_id')
    frequency = data.get('frequency', 'daily')
    hour = int(data.get('hour', 2))
    minute = int(data.get('minute', 0))
    day_of_week = str(data.get('day_of_week', '0'))
    day_of_month = str(data.get('day_of_month', '1'))
    log_enabled = bool(data.get('log_enabled', True))

    if script_id not in MODULE_REGISTRY:
        return jsonify({"error": "脚本不存在"}), 404
    if script_id not in CRON_SUPPORTED:
        return jsonify({"error": f"该模块（{MODULE_REGISTRY[script_id]['name']}）暂不支持定时执行"}), 400

    # Cron 时间表达式
    if frequency == 'daily':
        cron_time = f"{minute} {hour} * * *"
        day_names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
        time_desc = f"每天 {str(hour).zfill(2)}:{str(minute).zfill(2)}"
    elif frequency == 'weekly':
        cron_time = f"{minute} {hour} * * {day_of_week}"
        day_names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
        try:
            dname = day_names[int(day_of_week)]
        except (ValueError, IndexError):
            dname = day_of_week
        time_desc = f"每周{day_names[int(day_of_week)] if not ValueError else day_of_week} {str(hour).zfill(2)}:{str(minute).zfill(2)}"
    elif frequency == 'monthly':
        cron_time = f"{minute} {hour} {day_of_month} * *"
        time_desc = f"每月第{day_of_month}天 {str(hour).zfill(2)}:{str(minute).zfill(2)}"
    else:
        return jsonify({"error": "不支持的频率类型"}), 400

    mod = MODULE_REGISTRY[script_id]
    script_name = f"{mod['name_en'].lower().replace(' ', '_')}_install.sh"
    script_path = f"/opt/ubuntu-toolbox/scripts/{script_name}"
    log_path = f"/var/log/ubuntu-toolbox-{script_id}.log" if log_enabled else "/dev/null"
    redirect = f" >> {log_path} 2>&1" if log_enabled else " >> /dev/null 2>&1"
    cron_cmd = f"{cron_time} /bin/bash {script_path}{redirect}"

    steps = [
        f"1. 将脚本保存到: {script_path}",
        f"2. 赋予执行权限: sudo chmod +x {script_path}",
        f"3. 编辑 crontab: crontab -e",
        f"4. 在打开的编辑器中添加以下行，然后保存退出:",
        f"   {cron_cmd}",
        f"5. 确认 crontab 已生效: crontab -l",
    ]
    if log_enabled:
        steps.append(f"6. 查看执行日志: cat {log_path}")

    return jsonify({
        "script_id": script_id,
        "script_name": mod["name"],
        "frequency": frequency,
        "cron_time": cron_time,
        "time_desc": time_desc,
        "cron_cmd": cron_cmd,
        "usage_steps": steps,
        "log_path": log_path if log_enabled else None,
    })


@app.route('/api/cron_supported')
def cron_supported():
    return jsonify({
        "supported": CRON_SUPPORTED,
        "modules": {sid: MODULE_REGISTRY[sid]["name"] for sid in CRON_SUPPORTED},
    })


# ---------- 获取模块列表（供前端初始化） ----------
@app.route('/api/modules')
def get_modules():
    return jsonify({
        sid: {
            "name": m["name"],
            "name_en": m["name_en"],
            "icon": m["icon"],
            "description": m["description"],
            "os": m["os"],
            "instructions": m["instructions"],
            "preview_text": m.get("preview_text", ""),
            "versions": m.get("versions", []),
            "has_versions": bool(m.get("versions")),
            "cronable": m.get("cronable", False),
        }
        for sid, m in MODULE_REGISTRY.items()
    })


# ---------- 下载完整部署包 ----------
@app.route('/api/download/package')
def download_package():
    tmpdir = tempfile.mkdtemp(prefix="ubuntu_toolbox_")
    pkg_path = os.path.join(tmpdir, "ubuntu-toolbox")
    os.makedirs(os.path.join(pkg_path, "scripts"))
    os.makedirs(os.path.join(pkg_path, "static", "previews"), exist_ok=True)

    # 复制所有脚本文件
    for mod_id, mod in MODULE_REGISTRY.items():
        mod_dir = os.path.join(pkg_path, "scripts", mod["dir"])
        os.makedirs(mod_dir, exist_ok=True)

        # 通用脚本
        gen_script = read_script(mod_id, "")
        with open(os.path.join(mod_dir, "script.sh"), "w") as f:
            f.write(gen_script)
        os.chmod(os.path.join(mod_dir, "script.sh"), 0o755)

        # 版本专属脚本
        for ver in (mod.get("versions") or []):
            ver_script = read_script(mod_id, ver)
            with open(os.path.join(mod_dir, f"script_{ver}.sh"), "w") as f:
                f.write(ver_script)
            os.chmod(os.path.join(mod_dir, f"script_{ver}.sh"), 0o755)

    # 配置文件
    registry_content = [
        f"#!/bin/bash",
        f"# Ubuntu 工具箱 - 模块注册表",
        f"# 此文件记录所有可用模块，新增模块时在此注册即可",
        f"#",
        f"# 字段格式: 模块ID|模块名|是否支持Cron",
        f"#",
    ]
    for sid, m in MODULE_REGISTRY.items():
        registry_content.append(f"{sid}|{m['name']}|{'是' if m.get('cronable') else '否'}")

    with open(os.path.join(pkg_path, "scripts", "README.md"), "w") as f:
        f.write("# scripts/ 目录说明\n\n")
        f.write("每个子目录 = 一个功能模块，目录内包含：\n")
        f.write("- `script.sh` - 通用版本脚本\n")
        f.write("- `script_20.04.sh` - Ubuntu 20.04 专属（可选）\n")
        f.write("- `script_22.04.sh` - Ubuntu 22.04 专属（可选）\n")
        f.write("- `script_24.04.sh` - Ubuntu 24.04 专属（可选）\n\n")
        f.write("# 新增模块方法\n")
        f.write("1. 在 scripts/ 下创建新目录，如 `scripts/mytool/`\n")
        f.write("2. 放入 script.sh 和可选的版本脚本\n")
        f.write("3. 在 app.py 的 MODULE_REGISTRY 中注册（参考现有模块）\n")
        f.write("4. 在 templates/index.html 中添加对应的卡片 HTML\n\n")
        f.write("支持的占位符（脚本文件中使用，运行时自动替换）：\n")
        f.write("- {CUR_USER}  -> $(whoami)  动态获取当前用户名\n")
        f.write("- {HOME_DIR} -> {home_env_var} (运行时替换)\n")

    # requirements / Dockerfile / docker-compose / README
    with open(os.path.join(pkg_path, "requirements.txt"), "w") as f:
        f.write("flask>=3.0.0\ngunicorn>=21.0.0\n")

    dockerfile = """FROM python:3.10-slim
LABEL maintainer="Ubuntu Toolbox"
WORKDIR /app
RUN apt-get update && apt-get install -y wget gnupg2 curl gnome-terminal wine64 sudo && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
"""
    with open(os.path.join(pkg_path, "Dockerfile"), "w") as f:
        f.write(dockerfile)

    with open(os.path.join(pkg_path, "docker-compose.yml"), "w") as f:
        f.write("""version: '3.8'
services:
  ubuntu-toolbox:
    build: .
    container_name: ubuntu-toolbox
    ports:
      - "5000:5000"
    environment:
      - FLASK_APP=app.py
      - FLASK_ENV=production
    restart: unless-stopped
""")

    with open(os.path.join(pkg_path, "README.md"), "w") as f:
        f.write("""# Ubuntu 工具箱

Flask Web 可视化工具 | 模块化设计，支持扩展

## 功能模块
""")
        for sid, m in MODULE_REGISTRY.items():
            f.write(f"- {m['icon']} {m['name']} - {m['description']}\n")
        f.write("""
## 新增模块
在 `scripts/` 目录下添加子目录，放入脚本文件，在 `app.py` 的 `MODULE_REGISTRY` 中注册即可。

## 快速开始
```bash
pip install -r requirements.txt
python3 app.py
```
访问 http://localhost:5000
""")

    # 复制应用文件
    for fname in ["app.py", "requirements.txt"]:
        src = os.path.join(APP_DIR, fname)
        if os.path.exists(src):
            shutil.copy(src, pkg_path)

    for subdir in ["templates", "static"]:
        src = os.path.join(APP_DIR, subdir)
        dst = os.path.join(pkg_path, subdir)
        if os.path.exists(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)

    # 打包
    zip_path = os.path.join(tmpdir, "ubuntu-toolbox.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(pkg_path):
            for file in files:
                fpath = os.path.join(root, file)
                arcname = os.path.relpath(fpath, tmpdir)
                zf.write(fpath, arcname)

    return send_file(zip_path, as_attachment=True, download_name="ubuntu-toolbox.zip")


# ================================================================
# 启动
# ================================================================
if __name__ == '__main__':
    _debug = os.environ.get('ELECTRON_FLASK_ROOT', '') == ''
    app.run(host='0.0.0.0', port=int(os.environ.get('FLASK_PORT', 5000)), debug=_debug)
