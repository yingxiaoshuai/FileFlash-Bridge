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

  test('persists the active project, messages, and shared files across gateway restarts', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const fileSystem = new NodeFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 1024,
      fileSystem,
      rootDir,
      sessionId: 'session-c',
    });

    try {
      await gateway.initialize();
      const project = await gateway.createProject('持久化项目');
      await gateway.setActiveProject(project.id);
      await gateway.appendTextMessage('浏览器的新文本会落到当前项目。');
      const sharedFile = await gateway.saveInboundFile({
        bytes: encoder.encode('persisted payload'),
        name: 'persisted.txt',
      });
      await gateway.addSharedFile(sharedFile.id);

      const reloadedGateway = new InboundStorageGateway({
        compression: nodeGzipCompression,
        compressionThreshold: 1024,
        fileSystem,
        rootDir,
        sessionId: 'session-c',
      });
      const snapshot = await reloadedGateway.getSnapshot();
      const reloadedProject = snapshot.projects.find(item => item.id === project.id);
      const projectFiles = await reloadedGateway.listProjectFiles(project.id);
      const sharedFiles = await reloadedGateway.listSharedFiles();

      expect(snapshot.activeProjectId).toBe(project.id);
      expect(reloadedProject?.messages.map(message => message.content)).toEqual([
        '浏览器的新文本会落到当前项目。',
      ]);
      expect(projectFiles.map(file => file.id)).toEqual([sharedFile.id]);
      expect(sharedFiles.map(file => file.id)).toEqual([sharedFile.id]);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('removes deleted files from both the project list and the shared list', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const fileSystem = new NodeFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 1024,
      fileSystem,
      rootDir,
      sessionId: 'session-d',
    });

    try {
      await gateway.initialize();
      const file = await gateway.saveInboundFile({
        bytes: encoder.encode('delete me'),
        name: 'delete-me.txt',
      });
      await gateway.addSharedFile(file.id);

      await gateway.deleteFile(file.id);

      const snapshot = await gateway.getSnapshot();
      const projectFiles = await gateway.listProjectFiles();
      const sharedFiles = await gateway.listSharedFiles();

      expect(snapshot.files[file.id]).toBeUndefined();
      expect(snapshot.sharedFileIds).toHaveLength(0);
      expect(projectFiles).toHaveLength(0);
      expect(sharedFiles).toHaveLength(0);
      await expect(fileSystem.exists(file.storagePath)).resolves.toBe(false);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });
});
