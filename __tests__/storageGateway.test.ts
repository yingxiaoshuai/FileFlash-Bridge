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

  test('preserves an inbound file timestamp when one is provided', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 16,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'session-created-at',
    });

    try {
      await gateway.initialize();
      const createdAt = '2026-04-22T09:30:00.000Z';
      const storedFile = await gateway.saveInboundFile({
        bytes: encoder.encode('shared from extension'),
        createdAt,
        name: 'inbound.txt',
      });

      expect(storedFile.createdAt).toBe(createdAt);
      const snapshot = await gateway.getSnapshot();
      expect(snapshot.files[storedFile.id]?.createdAt).toBe(createdAt);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('copies large local files into storage and serves download chunks without loading the full file', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const fileSystem = new NodeFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 16,
      fileSystem,
      rootDir,
      sessionId: 'session-large-copy',
    });

    try {
      await gateway.initialize();
      const sourcePath = join(rootDir, 'source-large.bin');
      await fileSystem.writeFile(sourcePath, encoder.encode('0123456789abcdef'));

      const storedFile = await gateway.saveInboundFile({
        byteLength: 16,
        name: 'capture.bin',
        sourcePath,
      });
      const chunk = await gateway.prepareFileChunk(storedFile.id, 4, 6);

      expect(storedFile.compression).toBe('none');
      expect('base64' in chunk).toBe(true);
      if (!('base64' in chunk)) {
        throw new Error('Expected a base64-backed chunk for large files.');
      }

      const base64Chunk = chunk.base64;
      if (!base64Chunk) {
        throw new Error('Expected the chunk to include base64 content.');
      }

      expect(Buffer.from(base64Chunk, 'base64').toString('utf8')).toBe('456789');
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('does not persist a file record when the destination file is missing after save', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));

    class MissingDestinationFileSystemAdapter extends NodeFileSystemAdapter {
      override async copyFile(_sourcePath: string, _destinationPath: string) {
        // Simulate a platform copy path that resolves without leaving the file.
      }
    }

    const fileSystem = new MissingDestinationFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 16,
      fileSystem,
      rootDir,
      sessionId: 'session-missing-destination',
    });

    try {
      await gateway.initialize();
      const sourcePath = join(rootDir, 'source-image.png');
      await fileSystem.writeFile(sourcePath, encoder.encode('png-bytes'));

      await expect(
        gateway.saveInboundFile({
          byteLength: 9,
          mimeType: 'image/png',
          name: 'capture.png',
          sourcePath,
        }),
      ).rejects.toThrow(/Stored file is missing after write/);

      const snapshot = await gateway.getSnapshot();
      expect(Object.keys(snapshot.files)).toHaveLength(0);
      expect(snapshot.projects[0]?.fileIds).toHaveLength(0);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('prunes broken file records from the snapshot during initialization', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const fileSystem = new NodeFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 16,
      fileSystem,
      rootDir,
      sessionId: 'session-prune-missing',
    });

    try {
      await gateway.initialize();
      const storedFile = await gateway.saveInboundFile({
        bytes: encoder.encode('png-bytes'),
        mimeType: 'image/png',
        name: 'capture.png',
      });
      await gateway.addSharedFile(storedFile.id);
      await fileSystem.deletePath(storedFile.storagePath);

      const reloadedGateway = new InboundStorageGateway({
        compression: nodeGzipCompression,
        compressionThreshold: 16,
        fileSystem,
        rootDir,
        sessionId: 'session-prune-missing',
      });
      const snapshot = await reloadedGateway.getSnapshot();

      expect(Object.keys(snapshot.files)).toHaveLength(0);
      expect(snapshot.sharedFileIds).toHaveLength(0);
      expect(snapshot.projects[0]?.fileIds).toHaveLength(0);
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });

  test('keeps image uploads uncompressed and preserves their original bytes and extension', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 1024 * 1024,
      fileSystem: new NodeFileSystemAdapter(),
      rootDir,
      sessionId: 'session-image-binary',
    });

    const pngLikeBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x11, 0x22, 0x33,
      0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    ]);

    try {
      await gateway.initialize();
      const storedFile = await gateway.saveInboundFile({
        bytes: pngLikeBytes,
        mimeType: 'image/png',
        name: 'photo.png',
      });
      const restored = await gateway.prepareFileBytes(storedFile.id);

      expect(storedFile.compression).toBe('none');
      expect(storedFile.storagePath.endsWith('.png')).toBe(true);
      expect(Buffer.from(restored.bytes)).toEqual(Buffer.from(pngLikeBytes));
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

  test('falls back to another project or a replacement project after deleting the active project', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'ffb-storage-'));
    const fileSystem = new NodeFileSystemAdapter();
    const gateway = new InboundStorageGateway({
      compression: nodeGzipCompression,
      compressionThreshold: 1024,
      fileSystem,
      rootDir,
      sessionId: 'session-delete-active',
    });

    try {
      await gateway.initialize();
      const initialSnapshot = await gateway.getSnapshot();
      const initialProjectId = initialSnapshot.activeProjectId;
      const secondProject = await gateway.createProject('第二轮项目');

      await gateway.setActiveProject(secondProject.id);
      await gateway.deleteProject(secondProject.id);

      let snapshot = await gateway.getSnapshot();
      expect(snapshot.activeProjectId).toBe(initialProjectId);
      expect(snapshot.projects.map(project => project.id)).toEqual([initialProjectId]);

      await gateway.deleteProject(initialProjectId);

      snapshot = await gateway.getSnapshot();
      expect(snapshot.projects).toHaveLength(1);
      expect(snapshot.activeProjectId).toBe(snapshot.projects[0]?.id);
      expect(snapshot.projects[0]?.title).toBe('当前分享轮次');
    } finally {
      await rm(rootDir, {force: true, recursive: true});
    }
  });
});
