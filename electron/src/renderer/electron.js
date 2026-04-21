/**
 * Electron 渲染层入口
 * 由 Flask 页面通过 <script src="/electron/electron.js"> 引入
 * 自动检测是否在 Electron 环境中运行
 */

(function () {
  'use strict';

  // 非 Electron 环境直接退出
  if (typeof window.ELECTRON_BRIDGE === 'undefined') {
    console.log('[Electron] Running in browser mode, desktop features disabled.');
    return;
  }

  console.log('[Electron] Desktop mode active.');
  window.IS_ELECTRON = true;

  // ================================================================
  // 初始化
  // ================================================================
  let currentVersion = '';
  let scriptOutputCallback = null;
  let removeOutputListener = null;
  // SSH 服务器 ID -> connectionId 映射
  let connectedServerMap = {};

  // 初始化：获取系统版本，注入到页面
  async function init() {
    try {
      const info = await window.ELECTRON_BRIDGE.getSystemVersion();
      currentVersion = info.version;
      console.log('[Electron] System version:', info);

      // 如果页面有版本输入框，自动填入
      const versionInput = document.getElementById('ubuntuVersionInput');
      if (versionInput && versionInput.value === '') {
        versionInput.value = currentVersion;
        versionInput.dispatchEvent(new Event('input'));
      }

      // 如果有版本选择器，自动选中
      autoSelectVersion();
    } catch (err) {
      console.warn('[Electron] Could not detect version:', err.message);
    }

    // 注入设置面板按钮
    injectSettingsButton();

    // 注册脚本输出监听
    removeOutputListener = window.ELECTRON_BRIDGE.onScriptOutput(handleScriptOutput);

    console.log('[Electron] Init complete.');
  }

  // ================================================================
  // 版本自动选择
  // ================================================================
  function autoSelectVersion() {
    if (!currentVersion) return;
    // 从 version string 提取主版本号，如 "22.04" 从 "22.04.1"
    const majorVer = currentVersion.split('.')[0] + '.' + currentVersion.split('.')[1];

    // 遍历所有 version-select 下拉框
    document.querySelectorAll('.version-select').forEach(sel => {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === majorVer) {
          sel.value = majorVer;
          sel.dispatchEvent(new Event('change'));
          console.log('[Electron] Auto-selected version:', majorVer);
          break;
        }
      }
    });
  }

  // ================================================================
  // 实时终端日志面板
  // ================================================================
  function createTerminalPanel(scriptId) {
    const panelId = `terminal-${scriptId}`;
    console.log('[Terminal] 创建面板, panelId:', panelId);

    // 避免重复创建
    const existing = document.getElementById(panelId);
    if (existing) {
      existing.remove();
    }

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'electron-terminal-panel';
    panel.innerHTML = `
      <div class="et-header">
        <span class="et-title">📟 执行日志</span>
        <div class="et-actions">
          <span class="et-status" id="${panelId}-status">运行中</span>
          <button class="et-btn et-btn-stop" id="${panelId}-stop" title="停止">⏹</button>
          <button class="et-btn et-btn-clear" id="${panelId}-clear" title="清空">🗑</button>
          <button class="et-btn et-btn-close" id="${panelId}-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="et-body" id="${panelId}-body"></div>
    `;

    // 样式（首次注入）
    if (!document.getElementById('electron-terminal-style')) {
      const style = document.createElement('style');
      style.id = 'electron-terminal-style';
      style.textContent = `
        .electron-terminal-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 680px;
          max-width: calc(100vw - 40px);
          height: 400px;
          background: #1e1e1e;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          z-index: 99999;
          font-family: 'Fira Code', 'Courier New', 'Microsoft YaHei', 'PingFang SC', 'WenQuanYi Micro Hei', monospace;
          overflow: hidden;
        }
        .et-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #2d2d2d;
          border-bottom: 1px solid #3d3d3d;
          flex-shrink: 0;
        }
        .et-title { color: #a5d6ff; font-size: 0.85rem; font-weight: 600; }
        .et-actions { display: flex; align-items: center; gap: 8px; }
        .et-status { color: #4caf50; font-size: 0.75rem; padding: 2px 8px; background: rgba(76,175,80,0.2); border-radius: 10px; }
        .et-status.exiting { color: #ff9800; background: rgba(255,152,0,0.2); }
        .et-status.done { color: #90caf9; background: rgba(144,202,249,0.2); }
        .et-status.error { color: #ef5350; background: rgba(239,83,80,0.2); }
        .et-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 0.9rem; padding: 4px 6px; border-radius: 6px; transition: all 0.15s; }
        .et-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .et-btn-stop:hover { color: #ef5350; }
        .et-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 14px;
          color: #d4d4d4;
          font-size: 0.8rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .et-body .line-info { color: #89d185; }
        .et-body .line-error { color: #f48771; }
        .et-body .line-exit { color: #888; border-top: 1px dashed #444; margin-top: 8px; padding-top: 8px; }
        .et-body .line-stdout { color: #d4d4d4; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(panel);

    // 绑定按钮事件
    document.getElementById(`${panelId}-stop`).onclick = () => {
      window.ELECTRON_BRIDGE.terminateScript(scriptId);
      const status = document.getElementById(`${panelId}-status`);
      status.textContent = '已停止';
      status.className = 'et-status error';
    };

    document.getElementById(`${panelId}-clear`).onclick = () => {
      document.getElementById(`${panelId}-body`).innerHTML = '';
    };

    document.getElementById(`${panelId}-close`).onclick = () => {
      panel.remove();
    };

    return panelId;
  }

  // 处理脚本输出
  function handleScriptOutput(data) {
    const { scriptId, type, data: text, exitCode, sessionId } = data;
    // 优先尝试远程面板（scriptId 带 -remote 的情况）
    let body = document.getElementById(`terminal-${scriptId}-body`);
    if (!body) {
      // 尝试本地面板（去掉 -remote 后缀）
      const localId = scriptId.replace(/-remote$/, '');
      body = document.getElementById(`terminal-${localId}-body`);
    }
    if (!body) {
      console.error('[Terminal] 未找到面板 body, scriptId:', scriptId, ', 已有的terminal面板:', [...document.querySelectorAll('[id^=terminal-]')].map(e=>e.id).join(', '));
      return;
    }
    // 用同样逻辑确定 panelId
    const panelId = scriptId.includes('-remote') ? `terminal-${scriptId}` : `terminal-${scriptId.replace(/-remote$/, '')}`;
    const status = document.getElementById(`${panelId}-status`);

    if (type === 'info') {
      body.innerHTML += `<span class="line-info">${escapeHtml(text)}</span>`;
    } else if (type === 'error') {
      body.innerHTML += `<span class="line-error">${escapeHtml(text)}</span>`;
    } else if (type === 'stdout') {
      body.innerHTML += `<span class="line-stdout">${escapeHtml(text)}</span>`;
    } else if (type === 'exit') {
      const cls = exitCode === 0 ? 'done' : 'error';
      const msg = exitCode === 0 ? '✅ 完成' : `❌ 退出码 ${exitCode}`;
      status.textContent = msg;
      status.className = `et-status ${cls}`;
      body.innerHTML += `<span class="line-exit">${'─'.repeat(50)}\n⏹ 进程已退出，退出码: ${exitCode}</span>`;
    }

    // 滚动到底部
    body.scrollTop = body.scrollHeight;
  }

  // ================================================================
  // 在脚本执行按钮上叠加「本地运行」按钮
  // ================================================================
  function injectLocalRunButtons() {
    document.querySelectorAll('.module-card').forEach(card => {
      // 查找模块 ID（通过父级 ID 推断）
      const cardWrap = card.closest('[id^="card_wrap_"]');
      if (!cardWrap) return;
      const moduleId = cardWrap.id.replace('card_wrap_', '');

      // 避免重复注入
      if (card.querySelector('.et-run-btn')) return;

      // 查找「查看脚本」按钮
      const viewBtn = card.querySelector('.btn-ubuntu');
      if (!viewBtn) return;

      // 创建「本地运行」按钮
      const runBtn = document.createElement('button');
      runBtn.className = 'btn et-run-btn';
      runBtn.style.cssText = 'background:#1a7f37;color:white;border:none;border-radius:8px;padding:0.6rem 1rem;font-size:0.88rem;cursor:pointer;';
      runBtn.innerHTML = '⚡ 本地运行';
      runBtn.title = '在 Electron 终端中运行此脚本（本地）';

      runBtn.onclick = async (e) => {
        e.stopPropagation();

        // 获取版本
        const verSel = card.querySelector('.version-select');
        const version = verSel ? verSel.value : '';

        // 获取模块 ID
        const modId = moduleId;

        // 创建终端面板
        createTerminalPanel(modId);

        // 执行脚本
        try {
          await window.ELECTRON_BRIDGE.executeScript({
            scriptId: modId,
            version: version,
            isRemote: false,
            sshServerId: null,
          });
        } catch (err) {
          const body = document.getElementById(`terminal-${modId}-body`);
          if (body) body.innerHTML += `<span class="line-error">启动失败: ${err.message}</span>`;
        }
      };

      // 插入按钮
      viewBtn.parentNode.insertBefore(runBtn, viewBtn.nextSibling);

      // 创建「远程运行」按钮
      const remoteRunBtn = document.createElement('button');
      remoteRunBtn.className = 'btn et-run-btn et-remote-btn';
      remoteRunBtn.style.cssText = 'background:#1565c0;color:white;border:none;border-radius:8px;padding:0.6rem 1rem;font-size:0.88rem;cursor:pointer;margin-left:8px;';
      remoteRunBtn.innerHTML = '🌐 远程运行';
      remoteRunBtn.title = '通过 SSH 在远程服务器上运行此脚本';

      remoteRunBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // 获取版本
        const verSel = card.querySelector('.version-select');
        const version = verSel ? verSel.value : '';

        // 获取可用 SSH 服务器
        let servers;
        try {
          servers = await window.ELECTRON_BRIDGE.sshGetServers();
          console.log('[远程运行] 服务器列表:', servers);
        } catch (err) {
          console.error('[远程运行] 获取服务器失败:', err.message);
          servers = [];
        }

        if (!servers || servers.length === 0) {
          alert('请先在「⚙️ 设置」中添加 SSH 服务器');
          return;
        }

        // 选择目标服务器
        let targetServer = null;
        if (servers.length === 1) {
          targetServer = servers[0];
        } else {
          const names = servers.map((s, i) => `  ${i + 1}. ${s.name || s.host} (${s.username}@${s.host})`);
          const selected = prompt('选择 SSH 服务器（输入序号）：\n' + names.join('\n'));
          const idx = parseInt(selected) - 1;
          if (isNaN(idx) || idx < 0 || idx >= servers.length) return;
          targetServer = servers[idx];
        }
        if (!targetServer) return;

        createTerminalPanel(moduleId + '-remote');

        // 获取或建立连接
        let connId = connectedServerMap[targetServer.id];
        if (!connId) {
          try {
            const result = await window.ELECTRON_BRIDGE.sshConnect(targetServer);
            connId = result.connectionId;
            connectedServerMap[targetServer.id] = connId;
          } catch (err) {
            const body = document.getElementById(`terminal-${moduleId}-remote-body`);
            if (body) body.innerHTML += `<span class="line-error">SSH 连接失败: ${err.message}</span>`;
            return;
          }
        }

        // 执行脚本（传入 connectionId）
        try {
          await window.ELECTRON_BRIDGE.executeScript({
            scriptId: moduleId,
            version: version,
            isRemote: true,
            sshServerId: connId, // 传 connectionId，不是 serverId
          });
        } catch (err) {
          const body2 = document.getElementById(`terminal-${moduleId}-remote-body`);
          if (body2) body2.innerHTML += `<span class="line-error">启动失败: ${err.message}</span>`;
        }
      };

      // 插入远程运行按钮
      viewBtn.parentNode.insertBefore(remoteRunBtn, viewBtn.nextSibling);
    });
  }

  // ================================================================
  // 设置面板
  // ================================================================
  let settingsPanelInjected = false;

  function injectSettingsButton() {
    if (settingsPanelInjected) return;

    // 在 header 区域添加设置按钮
    const headerActions = document.getElementById('et-header-actions');
    if (!headerActions || settingsPanelInjected) return;

    const btn = document.createElement('button');
    btn.id = 'et-settings-btn';
    btn.innerHTML = '⚙️ 设置';
    btn.style.cssText = 'background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.35);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:0.85rem;transition:all 0.2s;';
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.25)';
    btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.15)';
    btn.onclick = openSettingsPanel;
    headerActions.appendChild(btn);

    settingsPanelInjected = true;
  }

  async function openSettingsPanel() {
    // 加载已有配置
    const config = await window.ELECTRON_BRIDGE.getAllSettings();
    const servers = await window.ELECTRON_BRIDGE.sshGetServers();

    // 创建设置面板（modal）
    const modalId = 'et-settings-modal';
    let modal = document.getElementById(modalId);
    if (modal) { modal.remove(); }

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div style="background:white;border-radius:16px;width:720px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="background:#333;color:white;padding:1rem 1.5rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:1.1rem;font-weight:700;">⚙️ 设置</span>
          <button id="et-modal-close" style="background:none;border:none;color:white;font-size:1.2rem;cursor:pointer;">✕</button>
        </div>
        <div style="padding:1.5rem;">
          <!-- SSH 服务器 -->
          <h5 style="margin-bottom:1rem;">🖥 SSH 服务器</h5>
          <div id="et-servers-list"></div>
          <button id="et-add-server" style="background:#e95420;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;margin-top:8px;font-size:0.85rem;">+ 添加服务器</button>

          <!-- 通用设置 -->
          <h5 style="margin:1.5rem 0 1rem;">🔧 通用设置</h5>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label style="font-size:0.85rem;color:#555;">
              Flask 端口
              <input id="et-flask-port" type="number" value="${config.flaskPort || 38457}" style="width:100%;margin-top:4px;padding:6px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
            </label>
            <label style="font-size:0.85rem;color:#555;">
              脚本超时（秒）
              <input id="et-script-timeout" type="number" value="${config.scriptTimeout || 300}" style="width:100%;margin-top:4px;padding:6px 10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
            </label>
          </div>
          <div style="margin-top:12px;">
            <button id="et-save-settings" style="background:#1a7f37;color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:0.9rem;font-weight:600;">💾 保存设置</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 关闭按钮
    document.getElementById('et-modal-close').onclick = () => modal.remove();

    // 渲染服务器列表
    renderServerList(servers);

    // 添加服务器按钮
    document.getElementById('et-add-server').onclick = () => showServerForm(null, servers);

    // 保存设置
    document.getElementById('et-save-settings').onclick = async () => {
      const newConfig = {
        flaskPort: parseInt(document.getElementById('et-flask-port').value) || 38457,
        scriptTimeout: parseInt(document.getElementById('et-script-timeout').value) || 300,
      };
      await window.ELECTRON_BRIDGE.saveAllSettings(newConfig);
      alert('✅ 设置已保存');
    };
  }

  function renderServerList(servers) {
    const container = document.getElementById('et-servers-list');
    if (!container) return;

    if (!servers || servers.length === 0) {
      container.innerHTML = '<p style="color:#999;font-size:0.85rem;">暂无服务器，请点击「添加服务器」</p>';
      return;
    }

    container.innerHTML = servers.map(s => `
      <div style="background:#f8f9fa;border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(s.name || s.host)}</div>
          <div style="font-size:0.78rem;color:#888;margin-top:2px;">${escapeHtml(s.username)}@${escapeHtml(s.host)}:${s.port || 22}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="et-srv-test" data-id="${s.id}" style="background:#1565c0;color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.78rem;">🔗 连接测试</button>
          <button class="et-srv-edit" data-id="${s.id}" style="background:#555;color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.78rem;">✏️ 编辑</button>
          <button class="et-srv-del" data-id="${s.id}" style="background:#c62828;color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.78rem;">🗑 删除</button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    container.querySelectorAll('.et-srv-del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('确定删除此服务器？')) return;
        await window.ELECTRON_BRIDGE.sshRemoveServer(btn.dataset.id);
        const updated = await window.ELECTRON_BRIDGE.sshGetServers();
        renderServerList(updated);
      };
    });

    container.querySelectorAll('.et-srv-edit').forEach(btn => {
      btn.onclick = async () => {
        const allServers = await window.ELECTRON_BRIDGE.sshGetServers();
        showServerForm(btn.dataset.id, allServers);
      };
    });

    container.querySelectorAll('.et-srv-test').forEach(btn => {
      btn.onclick = async () => {
        btn.textContent = '连接中...';
        btn.disabled = true;
        const allServers = await window.ELECTRON_BRIDGE.sshGetServers();
        const srv = allServers.find(s => s.id === btn.dataset.id);
        if (!srv) { btn.textContent = '🔗 连接测试'; btn.disabled = false; return; }
        try {
          const result = await window.ELECTRON_BRIDGE.sshConnect(srv);
          await window.ELECTRON_BRIDGE.sshDisconnect(result.connectionId);
          btn.textContent = '✅ 连接成功';
          btn.style.background = '#1a7f37';
        } catch (err) {
          btn.textContent = '❌ 连接失败';
          btn.style.background = '#c62828';
        }
        setTimeout(() => {
          btn.textContent = '🔗 连接测试';
          btn.style.background = '#1565c0';
          btn.disabled = false;
        }, 2000);
      };
    });
  }

  function showServerForm(editId, servers) {
    const existingForm = document.getElementById('et-server-form');
    if (existingForm) existingForm.remove();

    const srv = editId ? servers.find(s => s.id === editId) : null;

    const formDiv = document.createElement('div');
    formDiv.id = 'et-server-form';
    formDiv.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999999;display:flex;align-items:center;justify-content:center;';
    formDiv.innerHTML = `
      <div style="background:white;border-radius:12px;width:500px;max-width:95vw;padding:1.5rem;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
        <h5 style="margin:0 0 1rem;">${srv ? '✏️ 编辑服务器' : '+ 添加服务器'}</h5>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="ef-name" placeholder="服务器名称（如：生产服务器）" value="${srv?.name || ''}" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <input id="ef-host" placeholder="IP 地址或主机名" value="${srv?.host || ''}" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <input id="ef-port" type="number" placeholder="端口（默认22）" value="${srv?.port || 22}" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <input id="ef-username" placeholder="用户名" value="${srv?.username || ''}" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <select id="ef-authtype" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
            <option value="password" ${srv?.authType !== 'privateKey' ? 'selected' : ''}>🔑 密码认证</option>
            <option value="privateKey" ${srv?.authType === 'privateKey' ? 'selected' : ''}>🔐 私钥认证</option>
          </select>
          <input id="ef-password" type="password" placeholder="${srv?.authType === 'privateKey' ? '私钥密码（可选）' : '密码'}" value="" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <input id="ef-keypath" placeholder="私钥路径（如 ~/.ssh/id_rsa）" value="${srv?.privateKeyPath || ''}" style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:0.85rem;">
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button id="ef-cancel" style="background:#eee;color:#333;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">取消</button>
            <button id="ef-save" style="background:#e95420;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">保存</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(formDiv);

    formDiv.querySelector('#ef-cancel').onclick = () => formDiv.remove();

    formDiv.querySelector('#ef-save').onclick = async () => {
      const server = {
        name: document.getElementById('ef-name').value.trim(),
        host: document.getElementById('ef-host').value.trim(),
        port: parseInt(document.getElementById('ef-port').value) || 22,
        username: document.getElementById('ef-username').value.trim(),
        authType: document.getElementById('ef-authtype').value,
        password: document.getElementById('ef-password').value,
        privateKeyPath: document.getElementById('ef-keypath').value.trim(),
      };

      if (!server.host || !server.username) {
        alert('请填写主机和用户名');
        return;
      }

      if (editId) {
        await window.ELECTRON_BRIDGE.sshUpdateServer({ id: editId, server });
      } else {
        await window.ELECTRON_BRIDGE.sshAddServer(server);
      }

      formDiv.remove();
      const updated = await window.ELECTRON_BRIDGE.sshGetServers();
      renderServerList(updated);
    };
  }

  // ================================================================
  // 工具函数
  // ================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ================================================================
  // 启动
  // ================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // 延迟一下，等 Flask 页面渲染完成
    setTimeout(init, 500);
  }

  // 监听 DOM 变化，动态注入本地运行按钮（Flask 会动态渲染卡片）
  const observer = new MutationObserver(() => {
    if (!document.querySelector('.et-run-btn')) {
      setTimeout(injectLocalRunButtons, 200);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ================================================================
  // 自动更新提示
  // ================================================================
  let updateToast = null;
  async function showUpdateToast({ status, version, notes, percent, message }) {
    // 移除旧提示
    const old = document.getElementById('et-update-toast');
    if (old) old.remove();

    if (status === 'no-url') {
      // 显示提示：检查更新未配置
      const toast = document.createElement('div');
      toast.id = 'et-update-toast';
      toast.style.cssText = `position:fixed;top:20px;right:20px;z-index:999999;background:#1e1e1e;border:1px solid #3d3d3d;border-radius:12px;padding:16px 20px;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
      toast.innerHTML = `<div style="color:#f48771;font-size:0.9rem;">🔔 自动更新</div><div style="color:#888;font-size:0.82rem;margin-top:8px;">当前版本: ${await window.ELECTRON_BRIDGE.getVersion?.() || '1.0.0'}</div><div style="color:#666;font-size:0.78rem;margin-top:4px;">请到 GitHub Releases 下载最新版</div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
      return;
    }

    const toast = document.createElement('div');
    toast.id = 'et-update-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: #1e1e1e;
      border: 1px solid #3d3d3d;
      border-radius: 12px;
      padding: 16px 20px;
      max-width: 360px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      animation: slideIn 0.3s ease;
    `;

    if (status === 'checking') {
      toast.innerHTML = `<div style="color:#d4d4d4;font-size:0.9rem;">🔄 正在检查更新...</div>`;
    } else if (status === 'available') {
      toast.innerHTML = `
        <div style="color:#89d185;font-size:0.95rem;font-weight:600;margin-bottom:8px;">🎉 发现新版本 v${version}</div>
        <div style="color:#888;font-size:0.82rem;margin-bottom:12px;">${notes ? (typeof notes === 'string' ? notes : '') : (version ? '点击下载' : '')}</div>
        <button id="et-update-download" style="background:#e95420;color:white;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:0.85rem;">下载更新</button>
      `;
      document.body.appendChild(toast);
      document.getElementById('et-update-download').onclick = async () => {
        await window.ELECTRON_BRIDGE.updaterDownload();
      };
      return;
    } else if (status === 'downloading') {
      toast.innerHTML = `
        <div style="color:#d4d4d4;font-size:0.9rem;margin-bottom:8px;">📥 正在下载更新...</div>
        <div style="background:#333;border-radius:6px;height:6px;overflow:hidden;"><div style="background:#e95420;height:100%;width:${percent || 0}%;transition:width 0.3s;"></div></div>
        <div style="color:#888;font-size:0.78rem;margin-top:4px;">${(percent || 0).toFixed(1)}%</div>
      `;
    } else if (status === 'ready') {
      toast.innerHTML = `
        <div style="color:#89d185;font-size:0.95rem;font-weight:600;margin-bottom:8px;">✅ 更新已下载完成</div>
        <div style="color:#888;font-size:0.82rem;margin-bottom:12px;">v${version} 准备就绪</div>
        <button id="et-update-install" style="background:#1a7f37;color:white;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:0.85rem;">重启并更新</button>
      `;
      document.body.appendChild(toast);
      document.getElementById('et-update-install').onclick = () => {
        window.ELECTRON_BRIDGE.updaterInstall();
      };
      return;
    } else if (status === 'up-to-date') {
      // 不提示，已是最新
      return;
    } else if (status === 'error') {
      toast.innerHTML = `<div style="color:#f48771;font-size:0.85rem;">更新检查失败: ${notes || '未知错误'}</div>`;
      setTimeout(() => toast.remove(), 4000);
    }

    document.body.appendChild(toast);

    // 自动消失
    if (status !== 'ready' && status !== 'available') {
      setTimeout(() => toast.remove(), 5000);
    }
  }

  // 监听更新状态
  window.ELECTRON_BRIDGE.onUpdaterStatus(showUpdateToast);

})();
