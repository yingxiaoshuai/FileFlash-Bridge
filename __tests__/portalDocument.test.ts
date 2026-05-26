import { buildPortalDocument } from '../src/modules/portal/portalDocument';

describe('buildPortalDocument', () => {
  test('renders a compact portal hero and progress-based upload feedback', () => {
    const html = buildPortalDocument({
      binaryBridgeChunkSize: 128 * 1024,
      chunkSize: 8 * 1024 * 1024,
      deviceName: 'My iPhone',
      locale: 'en-US',
      securityMode: 'secure',
    });

    expect(html).toContain('Browser Transfer');
    expect(html).toContain('Upload to Phone');
    expect(html).toContain('Send Text');
    expect(html).toContain('Download From Phone');
    expect(html).toContain('Service offline');
    expect(html).toContain('device-pill');
    expect(html).toContain('progress-track');
    expect(html).toContain('progress-fill');
    expect(html).toContain('const activeDownloads = new Map();');
    expect(html).toContain('const downloadStateById = new Map();');
    expect(html).toContain('const selectedDownloadIds = new Set();');
    expect(html).toContain('const maxVisibleErrorMessageLength = 120;');
    expect(html).toContain('file-type-icon');
    expect(html).toContain("return { kind: 'model', label: '3D' };");
    expect(html).toContain('const maxConcurrentUploads = Math.max(');
    expect(html).toContain('const maxConcurrentUploadParts = Math.max(');
    expect(html).toContain('const uploadChunkSize = 8 * 1024 * 1024;');
    expect(html).toContain('file.size === 0');
    expect(html).toContain('uploadBinaryPart');
    expect(html).toContain('sendUploadBinaryPart');
    expect(html).toContain(
      "uploadUrl.searchParams.set('offset', String(offset));",
    );
    expect(html).toContain('attempt <= maxChunkAttempts');
    expect(html).toContain('request.send(body);');
    expect(html).toContain("'content-type': 'application/octet-stream'");
    expect(html).toContain('await waitForBrowserTurn();');
    expect(html).toContain('fetchWithTimeout');
    expect(html).toContain("url.searchParams.set('direct', '1');");
    expect(html).toContain('verifyDirectDownload(file)');
    expect(html).toContain("method: 'HEAD'");
    expect(html).toContain('startDirectDownload(file)');
    expect(html).toContain('downloadSelectedFiles');
    expect(html).toContain('await Promise.all(uploadWorkers);');
    expect(html).toContain('await Promise.all(uploadPartWorkers);');
    expect(html).toContain('maxConcurrentUploadParts');
    expect(html).toContain('buildVisibleErrorMessage(error)');
    expect(html).toContain('readServerErrorMessage(responseText)');
    expect(html).toContain('RNFSManager\\.read\\(\\).*NSInteger.*unsupported');
    expect(html).toContain('overflow-wrap: anywhere;');
    expect(html).toContain('data-download-selected');
    expect(html).toContain('download-toolbar');
    expect(html).toContain("state.phase === 'downloading'");
    expect(html).toContain('replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g');
    expect(html).not.toContain('replace(/{{s*(w+)s*}}/g');
    expect(html).not.toContain('浏览器投递');
    expect(html).not.toContain('hero-copy');
    expect(html).not.toContain('#f5efe3');
    expect(html).not.toContain('rgba(255, 249, 239');
    expect(html).not.toContain('singleUploadMaxBytes');
    expect(html).not.toContain('blobToBase64');
    expect(html).not.toContain("kind: 'base64'");
    expect(html).not.toContain('base64: base64');
    expect(html).not.toContain('file.size <= chunkSize');
    expect(html).not.toContain(
      'const bytes = new Uint8Array(await slice.arrayBuffer());',
    );
    expect(html).not.toContain('body: bytes');
    expect(html).not.toContain('body: slice');
    expect(html).not.toContain('fetchChunk');
    expect(html).not.toContain('downloadFileToTarget');
    expect(html).not.toContain('createDownloadTarget');
    expect(html).not.toContain('window.showSaveFilePicker');
    expect(html).not.toContain('response.body?.getReader?.()');
    expect(html).not.toContain(
      'const batchChunks = await Promise.all(batchRequests);',
    );
    expect(html).not.toContain('downloadedChunks');
    expect(html).not.toContain('chunkProgressByIndex');
    expect(html).not.toContain('createDownloadChunks');
    expect(html).not.toContain('Computer address');
    expect(html).not.toContain('computer-address');
    expect(html).not.toContain('copyComputerAddress');
  });
});
