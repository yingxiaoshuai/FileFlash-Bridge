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
  return {controller, rootDir, sharedFile};
}

describe('TransferServiceController', () => {
  test('serves secure APIs, accepts text upload, and exposes chunked downloads', async () => {
    const {controller, rootDir, sharedFile} = await createController();

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
          'content-type': 'application/json',
          'x-client-id': 'client-a',
        },
        body: JSON.stringify({text: '来自浏览器的新文本内容'}),
      });
      expect(textResponse.status).toBe(200);
      expect((await textResponse.json()).activeProjectTitle).toBeTruthy();

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
});
