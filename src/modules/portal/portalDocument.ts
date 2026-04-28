import {AppLocale, createAppTranslator} from '../localization/i18n';
import {SecurityMode} from '../service/models';
import {portalTheme} from './portalTheme';

export interface PortalDocumentModel {
  chunkSize: number;
  deviceName: string;
  locale: AppLocale;
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
  const t = createAppTranslator(model.locale);
  const portalText = {
    badge: 'FileFlash Bridge',
    browserUnavailable: t('portal.browserUnavailable'),
    chooseFiles: t('portal.chooseFiles'),
    chooseFolders: t('portal.chooseFolders'),
    deviceLabel: t('portal.deviceLabel', {deviceName: model.deviceName}),
    downloadBannerFailed: t('portal.download.bannerFailed'),
    downloadButton: t('portal.download.button'),
    downloadButtonAgain: t('portal.download.buttonAgain'),
    downloadButtonBusy: t('portal.download.buttonBusy'),
    downloadChunked: t('portal.download.chunked'),
    downloadComplete: t('portal.download.complete'),
    downloadFailed: t('portal.download.failed', {message: '__MESSAGE__'}),
    downloadInProgress: t('portal.download.inProgress', {percent: '__PERCENT__'}),
    downloadPending: t('portal.download.pending'),
    emptyShared: t('portal.emptyShared'),
    emptyUpload: t('portal.emptyUpload'),
    eyebrowShared: t('portal.eyebrowShared'),
    eyebrowText: t('portal.eyebrowText'),
    eyebrowUpload: t('portal.eyebrowUpload'),
    heroTitle: t('portal.heroTitle'),
    networkInterrupted: t('portal.networkInterrupted'),
    requestFailed: t('portal.requestFailed'),
    sectionShared: t('portal.sectionShared'),
    sectionText: t('portal.sectionText'),
    sectionUpload: t('portal.sectionUpload'),
    selectFilesFirst: t('portal.selectFilesFirst'),
    serviceOffline: t('portal.serviceOffline'),
    serviceOnline: t('portal.serviceOnline'),
    sharedUnavailable: t('portal.sharedUnavailable'),
    submitText: t('portal.submitText'),
    textEmpty: t('portal.text.empty'),
    textPlaceholder: t('portal.textPlaceholder'),
    textSentTo: t('portal.text.sentTo', {projectTitle: '__PROJECT__'}),
    title: t('portal.title', {deviceName: model.deviceName}),
    uploadComplete: t('portal.upload.complete'),
    uploadFailed: t('portal.upload.failed'),
    uploadPrompt: t('portal.uploadPrompt'),
    uploadSelection: t('portal.uploadSelection'),
    uploadSentToPhone: t('portal.upload.sentToPhone'),
    uploadUploading: t('portal.upload.inProgress'),
    uploadWaiting: t('portal.upload.pending'),
  };
  const escapedText = Object.fromEntries(
    Object.entries(portalText).map(([key, value]) => [key, escapeHtml(value)]),
  ) as Record<keyof typeof portalText, string>;
  const portalTextJson = JSON.stringify(portalText);

  return `<!DOCTYPE html>
<html lang="${model.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedText.title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: ${portalTheme.backdrop};
        --panel: ${portalTheme.panel};
        --panel-strong: ${portalTheme.panelStrong};
        --ink: ${portalTheme.ink};
        --muted: ${portalTheme.muted};
        --line: ${portalTheme.border};
        --line-soft: ${portalTheme.lineSoft};
        --accent: ${portalTheme.accent};
        --accent-strong: ${portalTheme.accentStrong};
        --accent-soft: ${portalTheme.accentSoft};
        --green: ${portalTheme.success};
        --green-soft: ${portalTheme.successSoft};
        --warn: ${portalTheme.warning};
        --warn-soft: ${portalTheme.warningSoft};
        --danger: ${portalTheme.danger};
        --danger-soft: ${portalTheme.dangerSoft};
        --glow-primary: ${portalTheme.glowPrimary};
        --glow-secondary: ${portalTheme.glowSecondary};
        --glow-tertiary: ${portalTheme.glowTertiary};
        --shadow: ${portalTheme.shadow};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      body {
        margin: 0;
        position: relative;
        overflow-x: hidden;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
        background:
          radial-gradient(circle at top right, var(--glow-primary), transparent 32%),
          radial-gradient(circle at left -10%, var(--glow-tertiary), transparent 42%),
          radial-gradient(circle at right 22%, var(--glow-secondary), transparent 30%),
          var(--bg);
        color: var(--ink);
      }

      body::before,
      body::after {
        content: "";
        pointer-events: none;
        position: fixed;
        inset: 0;
      }

      body::before {
        background:
          linear-gradient(120deg, rgba(255, 255, 255, 0.3), transparent 42%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 36%);
      }

      body::after {
        opacity: 0.18;
        background-image:
          linear-gradient(rgba(17, 24, 39, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(17, 24, 39, 0.05) 1px, transparent 1px);
        background-size: 24px 24px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 78%);
      }

      .shell {
        max-width: 1120px;
        margin: 0 auto;
        padding: 22px 16px 40px;
        position: relative;
        z-index: 1;
      }

      .hero,
      .panel {
        backdrop-filter: blur(18px) saturate(1.15);
        background: var(--panel);
        border: 1px solid var(--line-soft);
        border-radius: 30px;
        box-shadow: 0 24px 64px var(--shadow);
        overflow: hidden;
        position: relative;
      }

      .hero::after,
      .panel::after {
        content: "";
        pointer-events: none;
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent 38%);
      }

      .hero {
        margin-bottom: 14px;
        padding: 24px;
      }

      .hero-top {
        align-items: center;
        display: flex;
        gap: 14px;
        justify-content: space-between;
      }

      .badge {
        align-items: center;
        background: rgba(255, 255, 255, 0.66);
        border: 1px solid var(--line-soft);
        border-radius: 999px;
        color: var(--accent-strong);
        display: inline-flex;
        font-size: 12px;
        font-weight: 700;
        gap: 8px;
        letter-spacing: 0.08em;
        padding: 8px 13px;
        text-transform: uppercase;
      }

      .device-pill {
        align-self: flex-start;
        background: rgba(255, 255, 255, 0.62);
        border: 1px solid var(--line-soft);
        border-radius: 999px;
        color: var(--muted);
        font-size: 13px;
        padding: 10px 14px;
      }

      h1 {
        letter-spacing: -0.05em;
        line-height: 0.95;
        margin: 14px 0 0;
        font-size: clamp(2.4rem, 4vw, 3.9rem);
      }

      .hero-actions {
        margin-top: 14px;
      }

      .banner {
        background: rgba(231, 240, 253, 0.9);
        border: 1px solid rgba(20, 115, 230, 0.14);
        border-radius: 18px;
        color: var(--accent-strong);
        margin-top: 18px;
        padding: 14px 16px;
      }

      .banner[hidden] {
        display: none;
      }

      .banner.warn {
        background: var(--warn-soft);
        border-color: rgba(217, 130, 43, 0.18);
        color: #8b5717;
      }

      .service-pill {
        align-items: center;
        background: var(--panel-strong);
        border: 1px solid var(--line-soft);
        border-radius: 999px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        display: inline-flex;
        font-size: 14px;
        font-weight: 800;
        gap: 8px;
        padding: 10px 14px;
      }

      .service-dot {
        background: var(--warn);
        border-radius: 999px;
        height: 10px;
        width: 10px;
      }

      .service-pill.online .service-dot {
        background: var(--green);
      }

      .grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .panel {
        padding: 18px;
      }

      .panel-head {
        margin-bottom: 12px;
      }

      .eyebrow {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      .panel h2 {
        font-size: 1.35rem;
        letter-spacing: -0.03em;
        margin: 0;
      }

      .dropzone {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(243, 246, 250, 0.94));
        border: 1px dashed rgba(20, 115, 230, 0.26);
        border-radius: 22px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
        padding: 20px;
        text-align: center;
      }

      .dropzone.active {
        background: rgba(231, 240, 253, 0.86);
        border-color: rgba(20, 115, 230, 0.45);
      }

      .button-row,
      .status-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .button-row {
        justify-content: center;
        margin-top: 16px;
      }

      button,
      .file-button {
        appearance: none;
        border: 1px solid transparent;
        border-radius: 999px;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        padding: 12px 16px;
        text-decoration: none;
        transition: transform 120ms ease, opacity 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }

      button:hover,
      .file-button:hover {
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
        transform: translateY(-1px);
      }

      button.primary,
      .file-button.primary {
        background: linear-gradient(180deg, var(--accent), var(--accent-strong));
        color: #ffffff;
      }

      button.ghost,
      .file-button.ghost {
        background: var(--panel-strong);
        border-color: var(--line);
        color: var(--ink);
      }

      textarea {
        background: var(--panel-strong);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
        font: inherit;
        line-height: 1.55;
        min-height: 128px;
        padding: 16px;
        resize: vertical;
        width: 100%;
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
        margin-top: 12px;
      }

      .item {
        background: var(--panel-strong);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
        padding: 14px 16px;
      }

      .item-head {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .item-title {
        font-weight: 800;
        word-break: break-word;
      }

      .item-meta,
      .item-status {
        color: var(--muted);
        font-size: 13px;
        margin-top: 6px;
      }

      .chip {
        align-items: center;
        border-radius: 999px;
        display: inline-flex;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        padding: 6px 10px;
        text-transform: uppercase;
      }

      .chip.ok {
        background: var(--green-soft);
        color: var(--green);
      }

      .chip.warn {
        background: var(--warn-soft);
        color: #8a5717;
      }

      .chip.danger {
        background: var(--danger-soft);
        color: var(--danger);
      }

      .progress-track {
        background: rgba(187, 200, 216, 0.4);
        border: 1px solid rgba(187, 200, 216, 0.56);
        border-radius: 999px;
        height: 8px;
        margin-top: 10px;
        overflow: hidden;
      }

      .progress-fill {
        background: linear-gradient(90deg, var(--accent), var(--accent-strong));
        border-radius: inherit;
        height: 100%;
        transition: width 140ms ease;
        width: 0%;
      }

      .progress-fill.ok {
        background: linear-gradient(90deg, #52b788, var(--green));
      }

      .progress-fill.danger {
        background: linear-gradient(90deg, #ef4444, var(--danger));
      }

      .hidden-input {
        display: none;
      }

      #text-feedback {
        margin: 14px 0 0;
        min-height: 22px;
      }

      @media (max-width: 760px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .hero,
        .panel {
          border-radius: 22px;
        }

        .hero {
          padding: 20px;
        }

        .hero-top {
          align-items: flex-start;
          flex-direction: column;
        }

        .button-row,
        .status-actions {
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="badge">${escapedText.badge}</div>
            <h1>${escapedText.heroTitle}</h1>
          </div>
          <div class="device-pill">${escapedText.deviceLabel}</div>
        </div>
        <div class="hero-actions">
          <div id="service-pill" class="service-pill">
            <span class="service-dot"></span>
            <span id="service-state">${escapedText.serviceOffline}</span>
          </div>
        </div>
        <div hidden id="status-banner" class="banner"></div>
      </section>

      <div class="grid">
        <section class="panel">
          <div class="panel-head">
            <div class="eyebrow">${escapedText.eyebrowUpload}</div>
            <h2>${escapedText.sectionUpload}</h2>
          </div>
          <div id="dropzone" class="dropzone">
            <div class="item-title">${escapedText.uploadPrompt}</div>
            <div class="button-row">
              <label class="file-button primary" for="file-input">${escapedText.chooseFiles}</label>
              <label class="file-button ghost" for="folder-input">${escapedText.chooseFolders}</label>
              <button id="upload-button" class="ghost" type="button">${escapedText.uploadSelection}</button>
            </div>
            <input id="file-input" class="hidden-input" type="file" multiple />
            <input id="folder-input" class="hidden-input" type="file" webkitdirectory directory multiple />
          </div>
          <div id="upload-list" class="upload-list"></div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div class="eyebrow">${escapedText.eyebrowText}</div>
            <h2>${escapedText.sectionText}</h2>
          </div>
          <textarea id="text-input" placeholder="${escapedText.textPlaceholder}"></textarea>
          <div class="status-actions" style="margin-top: 14px">
            <button id="text-submit" class="primary" type="button">${escapedText.submitText}</button>
            <button id="refresh-button" class="ghost" type="button">${escapeHtml(
              t('portal.refresh'),
            )}</button>
          </div>
          <p id="text-feedback" class="muted"></p>
        </section>
      </div>

      <section class="panel" style="margin-top: 16px">
        <div class="panel-head">
          <div class="eyebrow">${escapedText.eyebrowShared}</div>
          <h2>${escapedText.sectionShared}</h2>
        </div>
        <div id="download-list" class="download-list"></div>
      </section>
    </div>

    <script>
      const text = ${portalTextJson};
      const authKey = new URL(location.href).searchParams.get('key');
      const chunkSize = ${model.chunkSize};
      const maxChunkAttempts = 4;
      const activeDownloads = new Map();
      const downloadStateById = new Map();
      const fileQueue = [];
      const sharedFilesById = new Map();

      const dropzone = document.getElementById('dropzone');
      const uploadList = document.getElementById('upload-list');
      const downloadList = document.getElementById('download-list');
      const banner = document.getElementById('status-banner');
      const servicePill = document.getElementById('service-pill');
      const serviceState = document.getElementById('service-state');
      const textFeedback = document.getElementById('text-feedback');
      const textInput = document.getElementById('text-input');

      function withKey(path) {
        const url = new URL(path, location.origin);
        if (authKey) {
          url.searchParams.set('key', authKey);
        }
        return url.toString();
      }

      function escapeHtmlText(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function interpolate(template, params) {
        return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
          return params && params[key] != null ? String(params[key]) : '';
        });
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
        banner.hidden = false;
        banner.textContent = message;
        banner.className = tone === 'warn' ? 'banner warn' : 'banner';
      }

      function hideBanner() {
        banner.hidden = true;
        banner.textContent = '';
        banner.className = 'banner';
      }

      function setServiceOnline(online) {
        servicePill.className = online ? 'service-pill online' : 'service-pill';
        serviceState.textContent = online ? text.serviceOnline : text.serviceOffline;
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
          uploadList.innerHTML =
            '<div class="muted">' + escapeHtmlText(text.emptyUpload) + '</div>';
          return;
        }

        uploadList.innerHTML = fileQueue
          .map(file => {
            return '<div class="item"><div class="item-head"><div class="item-title">' +
              escapeHtmlText(file.name) +
              '</div><div class="chip warn">' +
              escapeHtmlText(text.uploadWaiting) +
              '</div></div><div class="item-meta">' +
              formatBytes(file.size) +
              (file.webkitRelativePath
                ? ' · ' + escapeHtmlText(file.webkitRelativePath)
                : '') +
              '</div></div>';
          })
          .join('');
      }

      function getDownloadState(fileId) {
        return downloadStateById.get(fileId) || {
          phase: 'idle',
          progress: 0,
        };
      }

      function buildDownloadButtonLabel(state) {
        if (state.phase === 'downloading') {
          return text.downloadButtonBusy;
        }
        if (state.phase === 'completed') {
          return text.downloadButtonAgain;
        }
        return text.downloadButton;
      }

      function buildDownloadStatusText(state) {
        if (state.phase === 'downloading') {
          return interpolate(text.downloadInProgress, {
            percent: Math.max(0, Math.min(100, Math.round((state.progress || 0) * 100))),
          });
        }
        if (state.phase === 'completed') {
          return text.downloadComplete;
        }
        if (state.phase === 'failed') {
          return interpolate(text.downloadFailed, {
            message: state.error || text.requestFailed,
          });
        }
        return text.downloadPending;
      }

      function renderDownloadState(fileId) {
        const itemNode = document.getElementById('download-item-' + fileId);
        if (!itemNode) {
          return;
        }

        const state = getDownloadState(fileId);
        const button = itemNode.querySelector('[data-download]');
        const statusNode = document.getElementById('download-status-' + fileId);
        if (button) {
          button.disabled = state.phase === 'downloading';
          button.textContent = buildDownloadButtonLabel(state);
        }
        if (statusNode) {
          statusNode.textContent = buildDownloadStatusText(state);
        }
      }

      function pruneDownloadStates(files) {
        const nextFileIds = new Set(files.map(file => file.id));
        for (const fileId of Array.from(downloadStateById.keys())) {
          if (!nextFileIds.has(fileId) && !activeDownloads.has(fileId)) {
            downloadStateById.delete(fileId);
          }
        }
      }

      function renderSharedFiles(files) {
        sharedFilesById.clear();
        for (const file of files) {
          sharedFilesById.set(file.id, file);
        }

        if (!files.length) {
          pruneDownloadStates([]);
          downloadList.innerHTML =
            '<div class="muted">' + escapeHtmlText(text.emptyShared) + '</div>';
          return;
        }

        pruneDownloadStates(files);
        downloadList.innerHTML = files
          .map(file => {
            const state = getDownloadState(file.id);
            return '<div id="download-item-' +
              escapeHtmlText(file.id) +
              '" class="item"><div class="item-head"><div><div class="item-title">' +
              escapeHtmlText(file.displayName) +
              '</div><div class="item-meta">' +
              formatBytes(file.size) +
              (file.isLargeFile ? ' · ' + escapeHtmlText(text.downloadChunked) : '') +
              '</div></div><button class="primary" data-download="' +
              escapeHtmlText(file.id) +
              '"' +
              (state.phase === 'downloading' ? ' disabled' : '') +
              '>' +
              escapeHtmlText(buildDownloadButtonLabel(state)) +
              '</button></div><div id="download-status-' +
              escapeHtmlText(file.id) +
              '" class="item-status">' +
              escapeHtmlText(buildDownloadStatusText(state)) +
              '</div></div>';
          })
          .join('');
      }

      async function loadStatus() {
        try {
          const response = await fetch(withKey('/api/status'), {
            headers: getClientHeaders(),
          });

          if (!response.ok) {
            throw new Error(text.browserUnavailable);
          }

          const payload = await response.json();
          setServiceOnline(payload.phase === 'running');
          hideBanner();
          await loadSharedFiles();
        } catch (error) {
          setServiceOnline(false);
          updateBanner(text.browserUnavailable, 'warn');
        }
      }

      async function loadSharedFiles() {
        const response = await fetch(withKey('/api/shared'), {
          headers: getClientHeaders(),
        });

        if (!response.ok) {
          sharedFilesById.clear();
          downloadList.innerHTML =
            '<div class="muted">' + escapeHtmlText(text.sharedUnavailable) + '</div>';
          return;
        }

        const payload = await response.json();
        renderSharedFiles(payload.files || []);
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
          throw new Error(payload.message || text.requestFailed);
        }

        return payload;
      }

      function getUploadEntryNodes(entryId) {
        return {
          chip: document.querySelector('#' + entryId + ' .chip'),
          fill: document.querySelector('#' + entryId + ' .progress-fill'),
          status: document.querySelector('#' + entryId + ' .item-status'),
          track: document.querySelector('#' + entryId + ' .progress-track'),
        };
      }

      function setUploadProgress(entryId, progress) {
        const nodes = getUploadEntryNodes(entryId);
        const percentage = Math.max(0, Math.min(100, Math.round(progress * 100)));
        if (nodes.fill) {
          nodes.fill.style.width = percentage + '%';
        }
        if (nodes.track) {
          nodes.track.setAttribute('aria-valuenow', String(percentage));
        }
        if (nodes.status) {
          nodes.status.textContent = percentage + '%';
        }
      }

      function setUploadState(entryId, chipClass, chipLabel, statusText, progressClass) {
        const nodes = getUploadEntryNodes(entryId);
        if (nodes.chip) {
          nodes.chip.className = 'chip ' + chipClass;
          nodes.chip.textContent = chipLabel;
        }
        if (nodes.fill) {
          nodes.fill.className = 'progress-fill' + (progressClass ? ' ' + progressClass : '');
        }
        if (nodes.status) {
          nodes.status.textContent = statusText;
        }
      }

      function uploadBinarySingle(file, onProgress) {
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

            reject(new Error(payload.message || text.requestFailed));
          };

          request.onerror = () => {
            reject(new Error(text.networkInterrupted));
          };

          request.send(file);
        });
      }

      async function uploadBinaryWithProgress(file, onProgress) {
        const relativePath = file.webkitRelativePath || file.name;
        const mimeType = file.type || 'application/octet-stream';

        if (file.size <= chunkSize) {
          return uploadBinarySingle(file, onProgress);
        }

        let uploadId;
        try {
          const beginPayload = await postJson('/api/upload/begin', {
            mimeType: mimeType,
            name: file.name,
            relativePath: relativePath,
            totalBytes: file.size,
          });
          uploadId = beginPayload.uploadId;
          if (!uploadId || typeof uploadId !== 'string') {
            throw new Error(text.requestFailed);
          }

          onProgress(0);
          const totalChunks = Math.ceil(file.size / chunkSize);
          for (let index = 0; index < totalChunks; index += 1) {
            const start = index * chunkSize;
            const end = Math.min(file.size, start + chunkSize);
            const slice = file.slice(start, end);
            const buffer = await slice.arrayBuffer();
            const response = await fetch(
              withKey('/api/upload/part?uploadId=' + encodeURIComponent(uploadId)),
              {
                body: buffer,
                headers: getClientHeaders({
                  'content-type': 'application/octet-stream',
                }),
                method: 'POST',
              },
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload.message || text.requestFailed);
            }
            onProgress(end / file.size);
          }

          return await postJson('/api/upload/finish', {uploadId: uploadId});
        } catch (error) {
          if (uploadId) {
            try {
              await fetch(
                withKey('/api/upload/abort?uploadId=' + encodeURIComponent(uploadId)),
                {
                  body: JSON.stringify({uploadId: uploadId}),
                  headers: getClientHeaders({
                    'content-type': 'application/json',
                  }),
                  method: 'POST',
                },
              );
            } catch {
              /* ignore abort failures */
            }
          }
          throw error;
        }
      }

      async function uploadQueuedFiles() {
        if (fileQueue.length === 0) {
          updateBanner(text.selectFilesFirst, 'warn');
          return;
        }

        const filesToUpload = fileQueue.splice(0, fileQueue.length);
        uploadList.innerHTML = '';

        for (const file of filesToUpload) {
          const entryId = 'upload-' + Math.random().toString(16).slice(2);
          uploadList.insertAdjacentHTML(
            'beforeend',
            '<div class="item" id="' + entryId + '"><div class="item-head"><div class="item-title">' +
              escapeHtmlText(file.name) +
              '</div><div class="chip warn">' +
              escapeHtmlText(text.uploadUploading) +
              '</div></div><div class="item-meta">' +
              formatBytes(file.size) +
              (file.webkitRelativePath
                ? ' · ' + escapeHtmlText(file.webkitRelativePath)
                : '') +
              '</div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-fill"></div></div><div class="item-status">0%</div></div>',
          );

          try {
            await uploadBinaryWithProgress(file, progress => {
              setUploadProgress(entryId, progress);
            });
            setUploadProgress(entryId, 1);
            setUploadState(
              entryId,
              'ok',
              text.uploadComplete,
              text.uploadSentToPhone,
              'ok',
            );
          } catch (error) {
            setUploadState(
              entryId,
              'danger',
              text.uploadFailed,
              text.requestFailed + ': ' + error.message,
              'danger',
            );
            updateBanner(error.message, 'warn');
          }
        }

        renderUploadQueue();
        await loadStatus();
      }

      async function submitText() {
        const textValue = textInput.value.trim();
        if (!textValue) {
          textFeedback.textContent = text.textEmpty;
          return;
        }

        try {
          const response = await fetch(withKey('/api/text'), {
            method: 'POST',
            headers: getClientHeaders({
              'content-type': 'text/plain; charset=utf-8',
            }),
            body: textValue,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.message || text.requestFailed);
          }
          textFeedback.textContent = interpolate(text.textSentTo, {
            projectTitle: payload.activeProjectTitle,
          });
          textInput.value = '';
          await loadStatus();
        } catch (error) {
          textFeedback.textContent = error.message;
        }
      }

      async function fetchChunk(fileId, start, end) {
        let lastError = new Error(text.requestFailed);
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
              const responseText = await response.text();
              throw new Error(responseText || text.requestFailed);
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
        if (activeDownloads.has(file.id)) {
          return activeDownloads.get(file.id);
        }

        const downloadTask = (async () => {
          downloadStateById.set(file.id, {
            phase: 'downloading',
            progress: 0,
          });
          renderDownloadState(file.id);

          try {
            const chunks = [];
            const totalBytes = Math.max(0, Number(file.size) || 0);
            const totalChunks =
              totalBytes > 0 ? Math.max(1, Math.ceil(totalBytes / chunkSize)) : 0;
            for (let index = 0; index < totalChunks; index += 1) {
              const start = index * chunkSize;
              const end = Math.min(totalBytes, start + chunkSize);
              chunks.push(await fetchChunk(file.id, start, end));
              downloadStateById.set(file.id, {
                phase: 'downloading',
                progress: totalBytes > 0 ? end / totalBytes : 1,
              });
              renderDownloadState(file.id);
            }

            const blob = new Blob(chunks, {
              type: file.mimeType || 'application/octet-stream',
            });
            const link = document.createElement('a');
            const objectUrl = URL.createObjectURL(blob);
            link.href = objectUrl;
            link.download = file.displayName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

            downloadStateById.set(file.id, {
              phase: 'completed',
              progress: 1,
            });
            renderDownloadState(file.id);
          } catch (error) {
            downloadStateById.set(file.id, {
              error: error.message,
              phase: 'failed',
              progress: 0,
            });
            renderDownloadState(file.id);
            updateBanner(text.downloadBannerFailed, 'warn');
          } finally {
            activeDownloads.delete(file.id);
            renderDownloadState(file.id);
          }
        })();

        activeDownloads.set(file.id, downloadTask);
        renderDownloadState(file.id);
        return downloadTask;
      }

      document.getElementById('upload-button').addEventListener('click', uploadQueuedFiles);
      document.getElementById('refresh-button').addEventListener('click', loadStatus);
      document.getElementById('text-submit').addEventListener('click', submitText);
      downloadList.addEventListener('click', async event => {
        if (!(event.target instanceof Element)) {
          return;
        }
        const button = event.target.closest('[data-download]');
        if (!button) {
          return;
        }
        const fileId = button.getAttribute('data-download');
        const file = fileId ? sharedFilesById.get(fileId) : undefined;
        if (file) {
          await downloadSharedFile(file);
        }
      });
      document.getElementById('file-input').addEventListener('change', event => {
        pushFiles(event.target.files || []);
        event.target.value = '';
      });
      document.getElementById('folder-input').addEventListener('change', event => {
        pushFiles(event.target.files || []);
        event.target.value = '';
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
