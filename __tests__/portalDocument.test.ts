import {buildPortalDocument} from '../src/modules/portal/portalDocument';

describe('buildPortalDocument', () => {
  test('renders a compact portal hero and progress-based upload feedback', () => {
    const html = buildPortalDocument({
      chunkSize: 8 * 1024 * 1024,
      deviceName: 'My iPhone',
      locale: 'en-US',
      securityMode: 'secure',
    });

    expect(html).toContain('Browser Transfer');
    expect(html).toContain('Upload to Phone');
    expect(html).toContain('Send Text');
    expect(html).toContain('Shared From Phone');
    expect(html).toContain('Service offline');
    expect(html).toContain('device-pill');
    expect(html).toContain('progress-track');
    expect(html).toContain('progress-fill');
    expect(html).toContain('const activeDownloads = new Map();');
    expect(html).toContain('const downloadStateById = new Map();');
    expect(html).toContain('const maxConcurrentDownloadChunks = Math.max(');
    expect(html).toContain('const uploadChunkSize = chunkSize;');
    expect(html).toContain('file.size === 0');
    expect(html).toContain('const bytes = new Uint8Array(await slice.arrayBuffer());');
    expect(html).toContain('body: bytes');
    expect(html).toContain("'content-type': 'application/octet-stream'");
    expect(html).toContain('await waitForBrowserTurn();');
    expect(html).toContain("state.phase === 'downloading'");
    expect(html).toContain('await Promise.all(');
    expect(html).toContain('downloadedChunks[descriptor.index] = chunk;');
    expect(html).toContain('response.body?.getReader?.()');
    expect(html).toContain('const chunkProgressByIndex = new Array(chunkPlan.length).fill(0);');
    expect(html).toContain('replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g');
    expect(html).toContain('setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);');
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
  });
});
