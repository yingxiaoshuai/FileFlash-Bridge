import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {InboundStorageGateway} from '../src/modules/file-access/inboundStorageGateway';
import {NodeFileSystemAdapter, nodeGzipCompression} from '../src/test-support/node';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('InboundStorageGateway', () => {
  test('compresses small files, restores original bytes, and resolves name conflicts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 1024,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'session-a',
    });

    try {
      await gateway.initialize();

      const first = await gateway.saveInboundFile({
        bytes: encoder.encode('hello fileflash bridge'),
        name: 'note.txt',
      });
      const second = await gateway.saveInboundFile({
        bytes: encoder.encode('hello again'),
        name: 'note.txt',
      });
      const restored = await gateway.prepareFileBytes(first.id);

      expect(first.compression).toBe('gzip');
      expect(second.relativePath).toBe('note (1).txt');
      expect(decoder.decode(restored.bytes)).toBe('hello fileflash bridge');
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('tracks active projects, shared files, and skips compression for large payloads', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 16,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'session-b',
    });

    try {
      await gateway.initialize();
      const project = await gateway.createProject('第二轮分享');
      await gateway.setActiveProject(project.id);
      await gateway.appendTextMessage('新的文本会进入当前活跃项目。');

      const largeFile = await gateway.saveInboundFile({
        bytes: new Uint8Array(64).fill(7),
        name: 'capture.bin',
      });
      await gateway.addSharedFile(largeFile.id);

      const snapshot = await gateway.getSnapshot();
      const activeProject = snapshot.projects.find(item => item.id === project.id);

      expect(largeFile.compression).toBe('none');
      expect(snapshot.activeProjectId).toBe(project.id);
      expect(snapshot.sharedFileIds).toContain(largeFile.id);
      expect(activeProject?.messages).toHaveLength(1);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });
});
