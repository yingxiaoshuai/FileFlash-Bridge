import {SecurityMode} from '../service/models';

export interface PortalDocumentModel {
  chunkSize: number;
  deviceName: string;
  securityMode: SecurityMode;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPortalDocument(model: PortalDocumentModel) {
  const deviceName = escapeHtml(model.deviceName);

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${deviceName} · FileFlash Bridge</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe3;
        --paper: rgba(255, 249, 239, 0.92);
        --ink: #182028;
        --muted: #5d665c;
        --line: #d7c6ac;
        --accent: #d4642b;
        --accent-strong: #9c451a;
        --navy: #1f3a5f;
        --green: #2e8a58;
        --warn: #c46f1f;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(212, 100, 43, 0.18), transparent 28%),
          radial-gradient(circle at left bottom, rgba(31, 58, 95, 0.12), transparent 28%),
          var(--bg);
        color: var(--ink);
      }

      .shell {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }

      .hero,
      .panel {
        backdrop-filter: blur(10px);
        background: var(--paper);
        border: 1px solid rgba(215, 198, 172, 0.95);
        border-radius: 28px;
        box-shadow: 0 24px 60px rgba(24, 32, 40, 0.08);
      }

      .hero {
        padding: 28px;
        margin-bottom: 16px;
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(31, 58, 95, 0.1);
        color: var(--navy);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 10px;
        font-size: clamp(2.3rem, 4vw, 3.7rem);
        line-height: 0.95;
      }

      .hero-copy {
        max-width: 760px;
        color: var(--muted);
        line-height: 1.65;
        font-size: 15px;
      }

      .banner {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(31, 58, 95, 0.08);
        color: var(--navy);
      }

      .banner.warn {
        background: rgba(196, 111, 31, 0.14);
        color: #78460c;
      }

      .status-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-top: 18px;
      }

      .status-card {
        padding: 16px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.62);
        border: 1px solid rgba(215, 198, 172, 0.9);
      }

      .status-label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .status-value {
        margin-top: 8px;
        font-size: 16px;
        font-weight: 800;
        word-break: break-word;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .panel {
        padding: 22px;
      }

      .panel h2 {
        margin: 0 0 8px;
        font-size: 1.35rem;
      }

      .panel-copy {
        color: var(--muted);
        line-height: 1.55;
        margin: 0 0 18px;
      }

      .dropzone {
        border: 2px dashed rgba(31, 58, 95, 0.2);
        border-radius: 22px;
        padding: 24px;
        text-align: center;
        background: rgba(255, 255, 255, 0.62);
      }

      .dropzone.active {
        border-color: rgba(212, 100, 43, 0.7);
        background: rgba(212, 100, 43, 0.08);
      }

      .button-row,
      .status-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      button,
      .file-button {
        appearance: none;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease;
      }

      button:hover,
      .file-button:hover {
        transform: translateY(-1px);
      }

      button.primary,
      .file-button.primary {
        background: var(--accent);
        color: #fff7f0;
      }

      button.ghost,
      .file-button.ghost {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(215, 198, 172, 0.92);
        color: var(--ink);
      }

      textarea {
        width: 100%;
        min-height: 160px;
        resize: vertical;
        border-radius: 20px;
        border: 1px solid rgba(215, 198, 172, 0.95);
        padding: 16px;
        font: inherit;
        line-height: 1.55;
        background: rgba(255, 255, 255, 0.8);
      }

      .muted {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }

      .upload-list,
      .download-list {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }

      .item {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(215, 198, 172, 0.92);
      }

      .item-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .item-title {
        font-weight: 800;
        word-break: break-word;
      }

      .item-meta,
      .item-status {
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .chip.ok {
        background: rgba(46, 138, 88, 0.14);
        color: var(--green);
      }

      .chip.warn {
        background: rgba(196, 111, 31, 0.14);
        color: #8a4e0e;
      }

      .hidden-input {
        display: none;
      }

      @media (max-width: 760px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .hero,
        .panel {
          border-radius: 22px;
        }

        .hero-top {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div class="badge">FileFlash Bridge</div>
          <div class="muted">设备：${deviceName}</div>
        </div>
        <h1>浏览器投递工作台</h1>
        <p class="hero-copy">
          无需安装 App，直接把文件、文件夹或文本投递到手机端当前会话。共享文件区只会展示手机用户显式加入共享列表的内容。
        </p>
        <div id="status-banner" class="banner">
          正在连接手机端服务并同步当前共享状态…
        </div>
        <div class="status-strip">
          <div class="status-card">
            <div class="status-label">连接状态</div>
            <div id="status-phase" class="status-value">等待响应</div>
          </div>
          <div class="status-card">
            <div class="status-label">访问模式</div>
            <div id="status-mode" class="status-value">${
              model.securityMode === 'secure' ? '安全模式' : '简单模式'
            }</div>
          </div>
          <div class="status-card">
            <div class="status-label">活跃连接</div>
            <div id="status-connections" class="status-value">0</div>
          </div>
          <div class="status-card">
            <div class="status-label">共享文件</div>
            <div id="status-shares" class="status-value">0</div>
          </div>
        </div>
      </section>

      <div class="grid">
        <section class="panel">
          <h2>文件 / 文件夹上传</h2>
          <p class="panel-copy">
            成功后内容会保存在手机端 App 内会话，不会自动进入系统下载目录或相册。
          </p>
          <div id="dropzone" class="dropzone">
            <div class="item-title">把文件拖到这里，或者选择文件 / 文件夹</div>
            <p class="muted">支持目录上传的浏览器会保留相对路径结构。</p>
            <div class="button-row">
              <label class="file-button primary" for="file-input">选择文件</label>
              <label class="file-button ghost" for="folder-input">选择文件夹</label>
              <button id="upload-button" class="ghost" type="button">上传所选内容</button>
            </div>
            <input id="file-input" class="hidden-input" type="file" multiple />
            <input id="folder-input" class="hidden-input" type="file" webkitdirectory directory multiple />
          </div>
          <div id="upload-list" class="upload-list"></div>
        </section>

        <section class="panel">
          <h2>文本投递</h2>
          <p class="panel-copy">
            文本会进入手机端当前活跃项目，手机用户可以稍后手动复制，不会静默覆盖系统剪贴板。
          </p>
          <textarea id="text-input" placeholder="在这里粘贴内容，提交后会进入手机端接收区。"></textarea>
          <div class="status-actions" style="margin-top: 14px">
            <button id="text-submit" class="primary" type="button">提交文本</button>
            <button id="refresh-button" class="ghost" type="button">刷新状态</button>
          </div>
          <p id="text-feedback" class="muted"></p>
        </section>
      </div>

      <section class="panel" style="margin-top: 16px">
        <h2>当前共享文件</h2>
        <p class="panel-copy">
          这里只展示手机端显式加入共享列表的文件。大文件会按 ${Math.floor(
            model.chunkSize / (1024 * 1024),
          )} MB 分块下载；单分块首次失败后最多再重试 3 次。
        </p>
        <div id="download-list" class="download-list"></div>
      </section>
    </div>

    <script>
      const authKey = new URL(location.href).searchParams.get('key');
      const chunkSize = ${model.chunkSize};
      const maxChunkAttempts = 4;
      const fileQueue = [];

      const dropzone = document.getElementById('dropzone');
      const uploadList = document.getElementById('upload-list');
      const downloadList = document.getElementById('download-list');
      const banner = document.getElementById('status-banner');
      const statusPhase = document.getElementById('status-phase');
      const statusMode = document.getElementById('status-mode');
      const statusConnections = document.getElementById('status-connections');
      const statusShares = document.getElementById('status-shares');
      const textFeedback = document.getElementById('text-feedback');

      function withKey(path) {
        const url = new URL(path, location.origin);
        if (authKey) {
          url.searchParams.set('key', authKey);
        }
        return url.toString();
      }

      function formatBytes(size) {
        if (size >= 1024 * 1024) {
          return (size / (1024 * 1024)).toFixed(1) + ' MB';
        }
        if (size >= 1024) {
          return (size / 1024).toFixed(1) + ' KB';
        }
        return size + ' B';
      }

      function updateBanner(message, tone) {
        banner.textContent = message;
        banner.className = tone === 'warn' ? 'banner warn' : 'banner';
      }

      function getClientHeaders(extraHeaders = {}) {
        return {
          'x-client-id': getClientId(),
          ...extraHeaders,
        };
      }

      function getClientId() {
        const stored = localStorage.getItem('ffb-client-id');
        if (stored) {
          return stored;
        }
        const next = 'browser-' + Math.random().toString(16).slice(2);
        localStorage.setItem('ffb-client-id', next);
        return next;
      }

      function pushFiles(inputFiles) {
        for (const file of inputFiles) {
          fileQueue.push(file);
        }
        renderUploadQueue();
      }

      function renderUploadQueue() {
        if (fileQueue.length === 0) {
          uploadList.innerHTML = '<div class="muted">还没有待上传内容。</div>';
          return;
        }

        uploadList.innerHTML = fileQueue
          .map(
            file => '<div class="item"><div class="item-head"><div class="item-title">' +
              file.name +
              '</div><div class="chip warn">待上传</div></div><div class="item-meta">' +
              formatBytes(file.size) +
              (file.webkitRelativePath ? ' · ' + file.webkitRelativePath : '') +
              '</div></div>',
          )
          .join('');
      }

      async function loadStatus() {
        try {
        const response = await fetch(withKey('/api/status'), {
          headers: getClientHeaders(),
        });

          if (!response.ok) {
            throw new Error('服务暂不可用');
          }

          const payload = await response.json();
          statusPhase.textContent = payload.phase === 'running' ? '运行中' : payload.phase;
          statusMode.textContent = payload.securityMode === 'secure' ? '安全模式' : '简单模式';
          statusConnections.textContent = String(payload.activeConnections);
          statusShares.textContent = String(payload.sharedFileCount);
          updateBanner(payload.notice, payload.phase === 'running' ? 'ok' : 'warn');
          await loadSharedFiles();
        } catch (error) {
          statusPhase.textContent = '连接中断';
          updateBanner('手机端服务不可用或已停止，请等待恢复后重试。', 'warn');
        }
      }

      async function loadSharedFiles() {
        const response = await fetch(withKey('/api/shared'), {
          headers: getClientHeaders(),
        });

        if (!response.ok) {
          downloadList.innerHTML = '<div class="muted">当前无法读取共享列表。</div>';
          return;
        }

        const payload = await response.json();
        if (!payload.files.length) {
          downloadList.innerHTML = '<div class="muted">手机端还没有加入共享列表的文件。</div>';
          return;
        }

        downloadList.innerHTML = payload.files
          .map(
            file => '<div class="item"><div class="item-head"><div><div class="item-title">' +
              file.displayName +
              '</div><div class="item-meta">' +
              formatBytes(file.size) +
              (file.isLargeFile ? ' · 分块下载' : ' · 整文件下载') +
              '</div></div><button class="primary" data-download="' +
              file.id +
              '">下载</button></div><div id="download-status-' +
              file.id +
              '" class="item-status">准备就绪</div></div>',
          )
          .join('');

        for (const button of downloadList.querySelectorAll('[data-download]')) {
          button.addEventListener('click', async event => {
            const fileId = event.currentTarget.getAttribute('data-download');
            const file = payload.files.find(item => item.id === fileId);
            if (file) {
              await downloadSharedFile(file);
            }
          });
        }
      }

      async function postJson(path, body) {
        const response = await fetch(withKey(path), {
          method: 'POST',
          headers: getClientHeaders({
            'content-type': 'application/json',
          }),
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.message || '请求失败');
        }

        return payload;
      }

      function uploadBinaryWithProgress(file, onProgress) {
        return new Promise((resolve, reject) => {
          const request = new XMLHttpRequest();
          const uploadUrl = new URL(withKey('/api/upload'));
          uploadUrl.searchParams.set('name', file.name);
          uploadUrl.searchParams.set(
            'relativePath',
            file.webkitRelativePath || file.name,
          );

          request.open('POST', uploadUrl.toString(), true);
          const headers = getClientHeaders({
            'content-type': file.type || 'application/octet-stream',
          });
          for (const [key, value] of Object.entries(headers)) {
            request.setRequestHeader(key, value);
          }

          request.upload.onprogress = event => {
            if (event.lengthComputable) {
              onProgress(event.loaded / event.total);
            }
          };

          request.onreadystatechange = () => {
            if (request.readyState !== XMLHttpRequest.DONE) {
              return;
            }

            const payload = request.responseText
              ? JSON.parse(request.responseText)
              : {};

            if (request.status >= 200 && request.status < 300) {
              resolve(payload);
              return;
            }

            reject(new Error(payload.message || '请求失败'));
          };

          request.onerror = () => {
            reject(new Error('网络中断，上传未完成。'));
          };

          request.send(file);
        });
      }

      async function uploadQueuedFiles() {
        if (fileQueue.length === 0) {
          updateBanner('请先选择要上传的文件或文件夹。', 'warn');
          return;
        }

        for (const file of fileQueue.splice(0, fileQueue.length)) {
          const entryId = 'upload-' + Math.random().toString(16).slice(2);
          uploadList.insertAdjacentHTML(
            'afterbegin',
            '<div class="item" id="' + entryId + '"><div class="item-head"><div class="item-title">' +
              file.name +
              '</div><div class="chip warn">上传中</div></div><div class="item-status">正在发送到手机端 App 会话…</div></div>',
          );

          try {
            await uploadBinaryWithProgress(file, progress => {
              document.querySelector('#' + entryId + ' .item-status').textContent =
                '上传中 ' + Math.round(progress * 100) + '% · 正在写入手机端 App 会话…';
            });
            document.querySelector('#' + entryId + ' .chip').textContent = '成功';
            document.querySelector('#' + entryId + ' .chip').className = 'chip ok';
            document.querySelector('#' + entryId + ' .item-status').textContent =
              '上传成功，手机端已写入 App 内会话存储。';
          } catch (error) {
            document.querySelector('#' + entryId + ' .item-status').textContent =
              error.message + '。请检查网络或空间后重试上传。';
            updateBanner(error.message, 'warn');
          }
        }

        renderUploadQueue();
        await loadStatus();
      }

      async function submitText() {
        const text = document.getElementById('text-input').value.trim();
        if (!text) {
          textFeedback.textContent = '请先输入或粘贴要发送的文本内容。';
          return;
        }

        try {
          const payload = await postJson('/api/text', { text });
          textFeedback.textContent =
            '提交成功，文本已进入手机端活跃项目：' + payload.activeProjectTitle;
          document.getElementById('text-input').value = '';
          await loadStatus();
        } catch (error) {
          textFeedback.textContent = error.message;
        }
      }

      async function fetchChunk(fileId, start, end) {
        let lastError = new Error('下载失败');
        for (let attempt = 1; attempt <= maxChunkAttempts; attempt += 1) {
          try {
            const url = new URL(withKey('/api/shared/' + fileId + '/download'));
            url.searchParams.set('offset', String(start));
            url.searchParams.set('length', String(end - start));
            const response = await fetch(url.toString(), {
              headers: {
                'x-client-id': getClientId(),
              },
            });

            if (!response.ok) {
              const text = await response.text();
              throw new Error(text || '下载分块失败');
            }

            return new Uint8Array(await response.arrayBuffer());
          } catch (error) {
            lastError = error;
            if (attempt === maxChunkAttempts) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 260 * attempt));
          }
        }

        throw lastError;
      }

      async function downloadSharedFile(file) {
        const statusNode = document.getElementById('download-status-' + file.id);
        try {
          const chunks = [];
          const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
          for (let index = 0; index < totalChunks; index += 1) {
            const start = index * chunkSize;
            const end = Math.min(file.size, start + chunkSize);
            statusNode.textContent =
              '正在下载第 ' + (index + 1) + ' / ' + totalChunks + ' 个分块…';
            chunks.push(await fetchChunk(file.id, start, end));
          }

          const blob = new Blob(chunks, {
            type: file.mimeType || 'application/octet-stream',
          });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = file.displayName;
          link.click();
          URL.revokeObjectURL(link.href);
          statusNode.textContent = '下载完成，可保存完整文件。';
        } catch (error) {
          statusNode.textContent =
            '传输失败：' + error.message + '。单分块已按上限尝试 4 次。';
          updateBanner('下载失败，请检查网络或让手机端重新共享后再试。', 'warn');
        }
      }

      document.getElementById('upload-button').addEventListener('click', uploadQueuedFiles);
      document.getElementById('refresh-button').addEventListener('click', loadStatus);
      document.getElementById('text-submit').addEventListener('click', submitText);
      document.getElementById('file-input').addEventListener('change', event => {
        pushFiles(event.target.files || []);
      });
      document.getElementById('folder-input').addEventListener('change', event => {
        pushFiles(event.target.files || []);
      });

      dropzone.addEventListener('dragover', event => {
        event.preventDefault();
        dropzone.classList.add('active');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('active'));
      dropzone.addEventListener('drop', event => {
        event.preventDefault();
        dropzone.classList.remove('active');
        pushFiles(event.dataTransfer.files || []);
      });

      renderUploadQueue();
      loadStatus();
      setInterval(loadStatus, 5000);
    </script>
  </body>
</html>`;
}
