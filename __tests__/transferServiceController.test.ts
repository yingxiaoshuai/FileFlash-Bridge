import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { InboundStorageGateway } from '../src/modules/file-access/inboundStorageGateway';
import { DEFAULT_SERVICE_CONFIG } from '../src/modules/service/models';
import {
  ServiceRuntime,
  TransferServiceController,
} from '../src/modules/service/transferServiceController';
import {
  NodeFileSystemAdapter,
  NodeHttpRuntime,
  nodeGzipCompression,
} from '../src/test-support/node';

async function createController(
  maxActiveConnections = 3,
  configOverrides: Partial<typeof DEFAULT_SERVICE_CONFIG> = {},
  runtime: ServiceRuntime = new NodeHttpRuntime(),
) {
  const rootDir = await mkdtemp(join(tmpdir(), 'ffb-controller-'));
  const storage = new InboundStorageGateway({
    compression: nodeGzipCompression,
    compressionThreshold: 128,
    fileSystem: new NodeFileSystemAdapter(),
    rootDir,
    sessionId: 'controller-session',
  });

  const sharedFile = await storage.saveInboundFile({
    bytes: new TextEncoder().encode('demo-shared-payload'),
    name: 'shared.txt',
  });
  await storage.addSharedFile(sharedFile.id);

  const controller = new TransferServiceController({
    config: {
      ...DEFAULT_SERVICE_CONFIG,
      maxActiveConnections,
      port: 0,
      securityMode: 'secure',
      ...configOverrides,
    },
    networkProvider: async () => [
      {
        address: '127.0.0.1',
        family: 'IPv4',
        internal: false,
        modeHint: 'wifi',
        name: 'Wi-Fi',
      },
    ],
    runtime,
    storage,
  });

  await controller.start();
  return { controller, rootDir, sharedFile, storage };
}

describe('TransferServiceController', () => {
  test('serves secure APIs, accepts text upload, and exposes chunked downloads', async () => {
    const { controller, rootDir, sharedFile, storage } =
      await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      expect(key).toBeTruthy();

      const unauthorized = await fetch(`${accessUrl.origin}/api/status`);
      expect(unauthorized.status).toBe(401);

      const statusResponse = await fetch(
        `${accessUrl.origin}/api/status?key=${key}`,
        {
          headers: { 'x-client-id': 'client-a' },
        },
      );
      expect(statusResponse.status).toBe(200);
      const statusPayload = await statusResponse.json();
      expect(statusPayload.sharedFileCount).toBe(1);
      expect(statusPayload.binaryBridgeChunkSize).toBe(
        DEFAULT_SERVICE_CONFIG.binaryBridgeChunkSize,
      );

      const binaryUploadResponse = await fetch(
        `${accessUrl.origin}/api/upload?key=${key}&name=${encodeURIComponent(
          'incoming.txt',
        )}&relativePath=${encodeURIComponent('nested/incoming.txt')}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain',
            'x-client-id': 'client-a',
          },
          body: Buffer.from('uploaded via browser'),
        },
      );
      expect(binaryUploadResponse.status).toBe(200);
      expect((await binaryUploadResponse.json()).files).toHaveLength(1);

      const textResponse = await fetch(
        `${accessUrl.origin}/api/text?key=${key}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'x-client-id': 'client-a',
          },
          body: '来自浏览器的新文本内容',
        },
      );
      expect(textResponse.status).toBe(200);
      expect((await textResponse.json()).activeProjectTitle).toBeTruthy();
      const snapshot = await storage.getSnapshot();
      expect(snapshot.projects[0]?.messages.at(-1)?.content).toBe(
        '来自浏览器的新文本内容',
      );

      const sharedResponse = await fetch(
        `${accessUrl.origin}/api/shared?key=${key}`,
        {
          headers: { 'x-client-id': 'client-a' },
        },
      );
      const sharedPayload = await sharedResponse.json();
      expect(sharedPayload.files).toHaveLength(1);

      const downloadResponse = await fetch(
        `${accessUrl.origin}/api/shared/${sharedFile.id}/download?key=${key}&offset=0&length=4`,
        {
          headers: { 'x-client-id': 'client-a' },
        },
      );
      expect(downloadResponse.status).toBe(206);
      expect(
        Buffer.from(await downloadResponse.arrayBuffer()).toString('utf8'),
      ).toBe('demo');
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('accepts JSON files as upload bytes when the browser sends application/json', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');
      const jsonText = '{"name":"assembly","items":[1,2,3]}';

      const uploadResponse = await fetch(
        `${accessUrl.origin}/api/upload?key=${key}&name=${encodeURIComponent(
          'assembly.json',
        )}&relativePath=${encodeURIComponent('exports/assembly.json')}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-client-id': 'client-a',
          },
          body: Buffer.from(jsonText),
        },
      );

      expect(uploadResponse.status).toBe(200);
      expect((await uploadResponse.json()).files).toHaveLength(1);

      const uploadedFile = (await storage.listProjectFiles()).find(
        file => file.relativePath === 'exports/assembly.json',
      );
      expect(uploadedFile?.mimeType).toBe('application/json');

      const prepared = await storage.prepareFileBytes(uploadedFile!.id);
      expect(Buffer.from(prepared.bytes).toString('utf8')).toBe(jsonText);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('rejects new clients when the active session limit is reached', async () => {
    const { controller, rootDir } = await createController(1);

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      const first = await fetch(`${accessUrl.origin}/api/status?key=${key}`, {
        headers: { 'x-client-id': 'client-a' },
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${accessUrl.origin}/api/status?key=${key}`, {
        headers: { 'x-client-id': 'client-b' },
      });
      expect(second.status).toBe(429);
      expect((await second.json()).code).toBe('SESSION_LIMIT_REACHED');
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('renders portal and status copy in English when the app locale preference is en-US', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      await storage.setLocalePreference('en-US');
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      const pageResponse = await fetch(`${accessUrl.origin}/?key=${key}`, {
        headers: { 'x-client-id': 'client-a' },
      });
      expect(pageResponse.status).toBe(200);
      const html = await pageResponse.text();
      expect(html).toContain('Browser Transfer');
      expect(html).toContain('Upload to Phone');
      expect(html).toContain('Download From Phone');
      expect(html).not.toContain('浏览器投递');

      const statusResponse = await fetch(
        `${accessUrl.origin}/api/status?key=${key}`,
        {
          headers: { 'x-client-id': 'client-a' },
        },
      );
      expect(statusResponse.status).toBe(200);
      expect((await statusResponse.json()).notice).toBe(
        'Secure mode is active. The link and QR code already include the key.',
      );
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('restores the persisted security mode during initialization and writes back later changes', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-controller-security-'));
    const storage = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 128,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'controller-security-session',
    });

    const controller = new TransferServiceController({
      config: {
        ...DEFAULT_SERVICE_CONFIG,
        port: 0,
        securityMode: 'secure',
      },
      networkProvider: async () => [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: false,
          modeHint: 'wifi',
          name: 'Wi-Fi',
        },
      ],
      runtime: new NodeHttpRuntime(),
      storage,
    });

    try {
      await storage.setSecurityModePreference('simple');
      const started = await controller.start();

      expect(started.config.securityMode).toBe('simple');
      expect(await storage.getSecurityModePreference()).toBe('simple');

      const updated = await controller.setSecurityMode('secure');
      expect(updated.config.securityMode).toBe('secure');
      expect(await storage.getSecurityModePreference()).toBe('secure');
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('refreshAddress rebuilds the link from the refreshed runtime origin after the device IP changes', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-refresh-origin-'));
    const storage = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 128,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'refresh-origin-session',
    });

    let currentOrigin = 'http://192.168.0.8:8668';
    const runtime: ServiceRuntime = {
      async start({ port }) {
        const handle = {
          origin: currentOrigin,
          port,
          refreshOrigin: async () => {
            currentOrigin = 'http://192.168.0.25:8668';
            handle.origin = currentOrigin;
            return handle.origin;
          },
          stop: async () => {},
        };

        return handle;
      },
      async isRunning() {
        return true;
      },
    };

    const controller = new TransferServiceController({
      config: {
        ...DEFAULT_SERVICE_CONFIG,
        accessKey: 'test-refresh-key',
        port: 8668,
        securityMode: 'secure',
      },
      networkProvider: async () => [
        {
          address: '192.168.0.8',
          family: 'IPv4',
          internal: false,
          modeHint: 'wifi',
          name: 'Wi-Fi',
        },
      ],
      runtime,
      storage,
    });

    try {
      const started = await controller.start();
      const startedUrl = new URL(started.accessUrl ?? '');
      const startedKey = startedUrl.searchParams.get('key');

      expect(startedUrl.hostname).toBe('192.168.0.8');
      expect(startedKey).toBe('test-refresh-key');

      const refreshed = await controller.refreshAddress({
        rotateAccessKey: true,
      });
      const refreshedUrl = new URL(refreshed.accessUrl ?? '');

      expect(refreshedUrl.hostname).toBe('192.168.0.25');
      expect(refreshed.network.address).toBe('192.168.0.25');
      expect(refreshedUrl.searchParams.get('key')).toBeTruthy();
      expect(refreshedUrl.searchParams.get('key')).not.toBe(startedKey);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('uses the local browser forward when the runtime is on an emulator-only address', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-emulator-origin-'));
    const storage = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 128,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'emulator-origin-session',
    });

    const runtime: ServiceRuntime = {
      async start({ port }) {
        return {
          port,
          stop: async () => {},
        };
      },
      async isRunning() {
        return true;
      },
    };

    const controller = new TransferServiceController({
      config: {
        ...DEFAULT_SERVICE_CONFIG,
        accessKey: 'test-emulator-key',
        port: 8668,
        securityMode: 'secure',
      },
      networkProvider: async () => [
        {
          address: '10.0.2.15',
          family: 'IPv4',
          internal: false,
          name: 'Wi-Fi',
        },
      ],
      runtime,
      storage,
    });

    try {
      const started = await controller.start();
      const startedUrl = new URL(started.accessUrl ?? '');

      expect(startedUrl.hostname).toBe('127.0.0.1');
      expect(startedUrl.port).toBe('8668');
      expect(started.network.address).toBe('10.0.2.15');
      expect(startedUrl.searchParams.get('key')).toBe('test-emulator-key');
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('accepts Uint8Array bridge uploads and returns Uint8Array download chunks for large files', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const bytes = new TextEncoder().encode('bridge upload payload');

      const uploadResponse = await controller.handleRequest({
        body: bytes,
        headers: {
          'content-type': 'application/octet-stream',
          'x-client-id': 'client-a',
        },
        method: 'POST',
        path: '/api/upload',
        query: new URLSearchParams({
          key,
          name: 'bridge.bin',
          relativePath: 'incoming/bridge.bin',
        }),
      });

      expect(uploadResponse.status).toBe(200);

      const uploadedFile = (await storage.listProjectFiles()).find(
        file => file.displayName === 'bridge.bin',
      );
      expect(uploadedFile).toBeTruthy();
      await storage.addSharedFile(uploadedFile!.id);

      const downloadResponse = await controller.handleRequest({
        headers: { 'x-client-id': 'client-a' },
        method: 'GET',
        path: `/api/shared/${uploadedFile!.id}/download`,
        query: new URLSearchParams({
          key,
          offset: '0',
          length: '6',
        }),
      });

      expect(downloadResponse.status).toBe(206);
      const downloadBody = downloadResponse.body;
      expect(downloadBody).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(downloadBody as Uint8Array).toString('utf8')).toBe(
        'bridge',
      );
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('accepts idempotent chunk upload retries by offset', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const bytes = new TextEncoder().encode('data');

      const beginResponse = await controller.handleRequest({
        body: {
          mimeType: 'application/octet-stream',
          name: 'retry.bin',
          relativePath: 'incoming/retry.bin',
          totalBytes: bytes.byteLength,
        },
        headers: {
          'content-type': 'application/json',
          'x-client-id': 'client-a',
        },
        method: 'POST',
        path: '/api/upload/begin',
        query: new URLSearchParams({key}),
      });
      const uploadId = (beginResponse.body as {uploadId: string}).uploadId;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const partResponse = await controller.handleRequest({
          body: bytes,
          headers: {
            'content-type': 'application/octet-stream',
            'x-client-id': 'client-a',
          },
          method: 'POST',
          path: '/api/upload/part',
          query: new URLSearchParams({
            key,
            offset: '0',
            uploadId,
          }),
        });
        expect(partResponse.status).toBe(200);
      }

      const finishResponse = await controller.handleRequest({
        body: {uploadId},
        headers: {
          'content-type': 'application/json',
          'x-client-id': 'client-a',
        },
        method: 'POST',
        path: '/api/upload/finish',
        query: new URLSearchParams({key}),
      });

      expect(finishResponse.status).toBe(200);
      const uploadedFile = (await storage.listProjectFiles()).find(
        file => file.displayName === 'retry.bin',
      );
      expect(uploadedFile?.size).toBe(bytes.byteLength);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('clamps shared download chunks to the binary bridge size', async () => {
    const { controller, rootDir, sharedFile } = await createController(3, {
      binaryBridgeChunkSize: 6,
      chunkSize: 10,
    });

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';

      const downloadResponse = await controller.handleRequest({
        headers: { 'x-client-id': 'client-a' },
        method: 'GET',
        path: `/api/shared/${sharedFile.id}/download`,
        query: new URLSearchParams({
          key,
          offset: '0',
          length: '999',
        }),
      });

      expect(downloadResponse.status).toBe(206);
      expect(downloadResponse.headers?.['content-length']).toBe('6');
      expect(Buffer.from(downloadResponse.body as Uint8Array).toString('utf8')).toBe(
        'demo-s',
      );
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('returns source file metadata for shared downloads when runtime supports it', async () => {
    const runtime = new NodeHttpRuntime();
    runtime.supportsFileResponses = true;
    const { controller, rootDir, storage } = await createController(
      3,
      {
        binaryBridgeChunkSize: 5 * 1024 * 1024,
        chunkSize: 5 * 1024 * 1024,
      },
      runtime,
    );

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const sharedFile = await storage.saveInboundFile({
        bytes: new Uint8Array(256).fill(7),
        name: 'raw-download.bin',
      });
      await storage.addSharedFile(sharedFile.id);

      const downloadResponse = await controller.handleRequest({
        headers: { 'x-client-id': 'client-a' },
        method: 'GET',
        path: `/api/shared/${sharedFile.id}/download`,
        query: new URLSearchParams({
          key,
          offset: '0',
          length: String(5 * 1024 * 1024),
        }),
      });

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.body).toBeUndefined();
      expect(downloadResponse.bodyFile).toEqual({
        length: sharedFile.size,
        offset: 0,
        path: sharedFile.storagePath,
      });
      expect(downloadResponse.headers?.['content-length']).toBe(
        String(sharedFile.size),
      );
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('allows direct shared downloads to bypass the chunk length clamp', async () => {
    const runtime = new NodeHttpRuntime();
    runtime.supportsFileResponses = true;
    const { controller, rootDir, storage } = await createController(
      3,
      {
        binaryBridgeChunkSize: 5 * 1024 * 1024,
        chunkSize: 5 * 1024 * 1024,
      },
      runtime,
    );

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const sharedFile = await storage.saveInboundFile({
        bytes: new Uint8Array(5 * 1024 * 1024 + 123).fill(9),
        name: 'direct-download.bin',
      });
      await storage.addSharedFile(sharedFile.id);

      const downloadResponse = await controller.handleRequest({
        headers: { 'x-client-id': 'client-a' },
        method: 'GET',
        path: `/api/shared/${sharedFile.id}/download`,
        query: new URLSearchParams({
          direct: '1',
          key,
        }),
      });

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.bodyFile).toEqual({
        length: sharedFile.size,
        offset: 0,
        path: sharedFile.storagePath,
      });
      expect(downloadResponse.headers?.['content-length']).toBe(
        String(sharedFile.size),
      );
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('decodes Uint8Array text submissions as UTF-8 without Buffer globals', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const browserText =
        '\u6d4f\u89c8\u5668\u53d1\u9001\u7684\u4e2d\u6587\u5185\u5bb9';
      const originalBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
      const bytes = new TextEncoder().encode(browserText);

      try {
        (globalThis as { Buffer?: typeof Buffer }).Buffer = undefined;

        const textResponse = await controller.handleRequest({
          body: bytes,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'x-client-id': 'client-a',
          },
          method: 'POST',
          path: '/api/text',
          query: new URLSearchParams({ key }),
        });

        expect(textResponse.status).toBe(200);
      } finally {
        (globalThis as { Buffer?: typeof Buffer }).Buffer = originalBuffer;
      }

      const snapshot = await storage.getSnapshot();
      expect(snapshot.projects[0]?.messages.at(-1)?.content).toBe(browserText);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('accepts chunked upload via begin, part, and finish', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const headers = { 'x-client-id': 'client-a' };

      const begin = await controller.handleRequest({
        body: {
          mimeType: 'application/octet-stream',
          name: 'chunked.bin',
          relativePath: 'dir/chunked.bin',
          totalBytes: 10,
        },
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        method: 'POST',
        path: '/api/upload/begin',
        query: new URLSearchParams({ key }),
      });

      expect(begin.status).toBe(200);
      const uploadId = (begin.body as { uploadId?: string }).uploadId;
      expect(uploadId).toBeTruthy();

      const part = await controller.handleRequest({
        body: new TextEncoder().encode('0123456789'),
        headers: {
          ...headers,
          'content-type': 'application/octet-stream',
        },
        method: 'POST',
        path: '/api/upload/part',
        query: new URLSearchParams({ key, uploadId: uploadId ?? '' }),
      });
      expect(part.status).toBe(200);

      const finish = await controller.handleRequest({
        body: { uploadId },
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        method: 'POST',
        path: '/api/upload/finish',
        query: new URLSearchParams({ key }),
      });

      expect(finish.status).toBe(200);
      const files = (finish.body as { files?: { displayName: string }[] })
        .files;
      expect(files?.[0]?.displayName).toBe('chunked.bin');

      const listed = await storage.listProjectFiles();
      expect(listed.some(f => f.displayName === 'chunked.bin')).toBe(true);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('routes browser text and files into the newly active project after a project switch', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      const initialSnapshot = await storage.getSnapshot();
      const initialProjectId = initialSnapshot.activeProjectId;
      const secondProject = await storage.createProject('第二轮分享');
      await storage.setActiveProject(secondProject.id);

      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      const textResponse = await fetch(
        `${accessUrl.origin}/api/text?key=${key}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'x-client-id': 'client-a',
          },
          body: '切换后的文本',
        },
      );
      expect(textResponse.status).toBe(200);

      const uploadResponse = await fetch(
        `${accessUrl.origin}/api/upload?key=${key}&name=${encodeURIComponent(
          'after-switch.txt',
        )}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain',
            'x-client-id': 'client-a',
          },
          body: Buffer.from('after-switch-file'),
        },
      );
      expect(uploadResponse.status).toBe(200);

      const snapshot = await storage.getSnapshot();
      const firstProject = snapshot.projects.find(
        item => item.id === initialProjectId,
      );
      const activeProject = snapshot.projects.find(
        item => item.id === secondProject.id,
      );
      const activeProjectFiles = await storage.listProjectFiles(
        secondProject.id,
      );

      expect(firstProject?.messages).toHaveLength(0);
      expect(activeProject?.messages.at(-1)?.content).toBe('切换后的文本');
      expect(
        activeProjectFiles.some(
          file => file.displayName === 'after-switch.txt',
        ),
      ).toBe(true);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('resets the browser shared list after creating a new project', async () => {
    const { controller, rootDir, storage } = await createController();

    try {
      await storage.createProject('第三轮分享');

      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');
      const headers = { 'x-client-id': 'client-a' };

      const statusResponse = await fetch(
        `${accessUrl.origin}/api/status?key=${key}`,
        {
          headers,
        },
      );
      expect(statusResponse.status).toBe(200);
      expect((await statusResponse.json()).sharedFileCount).toBe(0);

      const sharedResponse = await fetch(
        `${accessUrl.origin}/api/shared?key=${key}`,
        {
          headers,
        },
      );
      expect(sharedResponse.status).toBe(200);
      expect((await sharedResponse.json()).files).toEqual([]);
    } finally {
      await controller.stop();
      await rm(rootDir, { force: true, recursive: true });
    }
  });
});
