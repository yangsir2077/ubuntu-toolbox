@echo off
chcp 65001 >nul
:: ============================================================
:: Ubuntu 工具箱桌面版 - Windows 平台打包脚本
:: 用法: BUILD.bat
:: ============================================================

echo ========================================
echo Ubuntu 工具箱 - Windows 打包
echo ========================================

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查 npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ npm 未安装
    pause
    exit /b 1
)

:: 安装依赖
echo ==> 安装依赖...
call npm install --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo ❌ npm install 失败
    pause
    exit /b 1
)

:: 编译 native 模块
echo ==> 编译 native 模块 (node-pty)...
if exist "node_modules\node-pty" (
    cd node_modules\node-pty
    call npx node-gyp configure
    call npx node-gyp build
    cd ..\..
)

:: 执行打包
echo ==> 开始打包 (Windows NSIS)...
echo ==> 这可能需要几分钟，请耐心等待...
call npx electron-builder --win

echo.
echo ========================================
echo ✅ 打包完成！
echo 安装包位于 dist\ 目录：
dir /b dist\ 2>nul || echo dist 目录为空
echo ========================================
pause
