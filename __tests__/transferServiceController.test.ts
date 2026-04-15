import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {InboundStorageGateway} from '../src/modules/file-access/inboundStorageGateway';
import {DEFAULT_SERVICE_CONFIG} from '../src/modules/service/models';
import {TransferServiceController} from '../src/modules/service/transferServiceController';
import {
  NodeFileSystemAdapter,
  NodeHttpRuntime,
  nodeGzipCompression,
} from '../src/test-support/node';

async function createController(maxActiveConnections = 3) {
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

  await controller.start();
  return {controller, rootDir, sharedFile, storage};
}

describe('TransferServiceController', () => {
  test('serves secure APIs, accepts text upload, and exposes chunked downloads', async () => {
    const {controller, rootDir, sharedFile, storage} = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      expect(key).toBeTruthy();

      const unauthorized = await fetch(`${accessUrl.origin}/api/status`);
      expect(unauthorized.status).toBe(401);

      const statusResponse = await fetch(
        `${accessUrl.origin}/api/status?key=${key}`,
        {
          headers: {'x-client-id': 'client-a'},
        },
      );
      expect(statusResponse.status).toBe(200);
      expect((await statusResponse.json()).sharedFileCount).toBe(1);

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

      const textResponse = await fetch(`${accessUrl.origin}/api/text?key=${key}`, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-client-id': 'client-a',
        },
        body: '来自浏览器的新文本内容',
      });
      expect(textResponse.status).toBe(200);
      expect((await textResponse.json()).activeProjectTitle).toBeTruthy();
      const snapshot = await storage.getSnapshot();
      expect(snapshot.projects[0]?.messages.at(-1)?.content).toBe(
        '来自浏览器的新文本内容',
      );

      const sharedResponse = await fetch(
        `${accessUrl.origin}/api/shared?key=${key}`,
        {
          headers: {'x-client-id': 'client-a'},
        },
      );
      const sharedPayload = await sharedResponse.json();
      expect(sharedPayload.files).toHaveLength(1);

      const downloadResponse = await fetch(
        `${accessUrl.origin}/api/shared/${sharedFile.id}/download?key=${key}&offset=0&length=4`,
        {
          headers: {'x-client-id': 'client-a'},
        },
      );
      expect(downloadResponse.status).toBe(206);
      expect(
        Buffer.from(await downloadResponse.arrayBuffer()).toString('utf8'),
      ).toBe('demo');
    } finally {
      await controller.stop();
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('rejects new clients when the active session limit is reached', async () => {
    const {controller, rootDir} = await createController(1);

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      const first = await fetch(`${accessUrl.origin}/api/status?key=${key}`, {
        headers: {'x-client-id': 'client-a'},
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${accessUrl.origin}/api/status?key=${key}`, {
        headers: {'x-client-id': 'client-b'},
      });
      expect(second.status).toBe(429);
      expect((await second.json()).code).toBe('SESSION_LIMIT_REACHED');
    } finally {
      await controller.stop();
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('accepts base64 bridge uploads and returns base64-backed download chunks for large files', async () => {
    const {controller, rootDir, storage} = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const base64Payload = Buffer.from('bridge upload payload').toString('base64');

      const uploadResponse = await controller.handleRequest({
        body: {
          base64: base64Payload,
          byteLength: Buffer.byteLength('bridge upload payload'),
          kind: 'base64',
        },
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
        headers: {'x-client-id': 'client-a'},
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
      if (downloadBody instanceof Uint8Array) {
        expect(Buffer.from(downloadBody).toString('utf8')).toBe('bridge');
      } else {
        expect(downloadBody).toEqual(
          expect.objectContaining({
            kind: 'base64',
          }),
        );
        const body = downloadBody as {base64: string};
        expect(Buffer.from(body.base64, 'base64').toString('utf8')).toBe('bridge');
      }
    } finally {
      await controller.stop();
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('accepts chunked upload via begin, part, and finish', async () => {
    const {controller, rootDir, storage} = await createController();

    try {
      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key') ?? '';
      const headers = {'x-client-id': 'client-a'};

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
        query: new URLSearchParams({key}),
      });

      expect(begin.status).toBe(200);
      const uploadId = (begin.body as {uploadId?: string}).uploadId;
      expect(uploadId).toBeTruthy();

      const part = await controller.handleRequest({
        body: new TextEncoder().encode('0123456789'),
        headers: {
          ...headers,
          'content-type': 'application/octet-stream',
        },
        method: 'POST',
        path: '/api/upload/part',
        query: new URLSearchParams({key, uploadId: uploadId ?? ''}),
      });
      expect(part.status).toBe(200);

      const finish = await controller.handleRequest({
        body: {uploadId},
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        method: 'POST',
        path: '/api/upload/finish',
        query: new URLSearchParams({key}),
      });

      expect(finish.status).toBe(200);
      const files = (finish.body as {files?: {displayName: string}[]}).files;
      expect(files?.[0]?.displayName).toBe('chunked.bin');

      const listed = await storage.listProjectFiles();
      expect(listed.some(f => f.displayName === 'chunked.bin')).toBe(true);
    } finally {
      await controller.stop();
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('routes browser text and files into the newly active project after a project switch', async () => {
    const {controller, rootDir, storage} = await createController();

    try {
      const initialSnapshot = await storage.getSnapshot();
      const initialProjectId = initialSnapshot.activeProjectId;
      const secondProject = await storage.createProject('第二轮分享');
      await storage.setActiveProject(secondProject.id);

      const accessUrl = new URL(controller.getState().accessUrl ?? '');
      const key = accessUrl.searchParams.get('key');

      const textResponse = await fetch(`${accessUrl.origin}/api/text?key=${key}`, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-client-id': 'client-a',
        },
        body: '切换后的文本',
      });
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
      const firstProject = snapshot.projects.find(item => item.id === initialProjectId);
      const activeProject = snapshot.projects.find(item => item.id === secondProject.id);
      const activeProjectFiles = await storage.listProjectFiles(secondProject.id);

      expect(firstProject?.messages).toHaveLength(0);
      expect(activeProject?.messages.at(-1)?.content).toBe('切换后的文本');
      expect(activeProjectFiles.some(file => file.displayName === 'after-switch.txt')).toBe(
        true,
      );
    } finally {
      await controller.stop();
      await rm(rootDir, {force: true, recursive: true});
    }
  });
});
