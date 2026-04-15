import {
  CompressionMode,
  ProjectRecord,
  SharedFileRecord,
  StorageSnapshot,
  TextMessage,
  createId,
} from '../service/models';

export const SESSION_DELETION_WARNING =
  '删除将清除该会话的数据及关联文件。如需保留文件，请先进入该会话执行“保存到…”或导出。';

export interface FileSystemAdapter {
  appendFile?(path: string, content: Uint8Array): Promise<void>;
  appendFileBase64?(path: string, contentBase64: string): Promise<void>;
  copyFile?(sourcePath: string, destinationPath: string): Promise<void>;
  deletePath(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(path: string): Promise<string[]>;
  readFileChunkBase64?(
    path: string,
    offset: number,
    length: number,
  ): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  writeFileBase64?(path: string, contentBase64: string): Promise<void>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
}

export interface CompressionAdapter {
  compress(content: Uint8Array): Promise<Uint8Array>;
  decompress(content: Uint8Array): Promise<Uint8Array>;
}

interface SaveInboundFileInputBase {
  mimeType?: string;
  name: string;
  projectId?: string;
  relativePath?: string;
}

interface SaveInboundBytesInput extends Omit<SaveInboundFileInputBase, 'bytes'> {
  bytes: Uint8Array;
}

interface SaveInboundBase64Input extends Omit<SaveInboundFileInputBase, 'bytes'> {
  base64: string;
  byteLength: number;
}

interface SaveInboundPathInput extends Omit<SaveInboundFileInputBase, 'bytes'> {
  byteLength: number;
  sourcePath: string;
}

export type SaveInboundFileInput =
  | SaveInboundBytesInput
  | SaveInboundBase64Input
  | SaveInboundPathInput;

export interface InboundStorageGatewayOptions {
  compression: CompressionAdapter;
  compressionThreshold: number;
  fileSystem: FileSystemAdapter;
  rootDir: string;
  sessionId: string;
}

const SNAPSHOT_FILE_NAME = 'session-state.json';
const TEMP_DIR_NAME = 'temp';

/** 单次 HTTP 分块体上限，避免原生 NanoHTTPD 将整段读入内存时 OOM。 */
const MAX_INBOUND_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
/** 单次会话声明的总大小上限。 */
const MAX_INBOUND_UPLOAD_TOTAL_BYTES = 12 * 1024 * 1024 * 1024;

type PendingInboundUpload = {
  mimeType?: string;
  name: string;
  receivedBytes: number;
  relativePath: string;
  tempPath: string;
  totalBytes: number;
};

type StoredFileChunk =
  | {
      base64: string;
      bytes?: never;
      contentLength: number;
      file: SharedFileRecord;
      totalSize: number;
    }
  | {
      base64?: never;
      bytes: Uint8Array;
      contentLength: number;
      file: SharedFileRecord;
      totalSize: number;
    };

export type PreparedFileChunk = StoredFileChunk;

export class InboundStorageGateway {
  private snapshot?: StorageSnapshot;

  private readonly pendingInboundUploads = new Map<string, PendingInboundUpload>();

  constructor(private readonly options: InboundStorageGatewayOptions) {}

  async initialize() {
    if (this.snapshot) {
      return this.snapshot;
    }

    await this.options.fileSystem.ensureDir(this.options.rootDir);
    await this.options.fileSystem.ensureDir(this.tempDirPath());

    const snapshotPath = this.snapshotFilePath();
    if (await this.options.fileSystem.exists(snapshotPath)) {
      const rawSnapshot = await this.options.fileSystem.readText(snapshotPath);
      this.snapshot = JSON.parse(rawSnapshot) as StorageSnapshot;
    } else {
      const firstProject = this.createProjectRecord('当前分享轮次');
      this.snapshot = {
        sessionId: this.options.sessionId,
        activeProjectId: firstProject.id,
        sharedFileIds: [],
        projects: [firstProject],
        files: {},
      };
      await this.persist();
    }

    await this.cleanupTemporaryArtifacts();

    return this.snapshot;
  }

  async getSnapshot() {
    await this.initialize();
    return this.cloneSnapshot();
  }

  async createProject(title?: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.createProjectRecord(title ?? '新的分享轮次');
    snapshot.projects.unshift(project);
    snapshot.activeProjectId = project.id;
    await this.persist();
    return project;
  }

  async setActiveProject(projectId: string) {
    const snapshot = await this.requireSnapshot();
    const project = snapshot.projects.find(item => item.id === projectId);
    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }

    snapshot.activeProjectId = projectId;
    await this.persist();
  }

  async appendTextMessage(content: string, projectId?: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);
    const message: TextMessage = {
      id: createId('msg'),
      projectId: project.id,
      content,
      createdAt: new Date().toISOString(),
      source: 'browser',
    };

    project.messages.push(message);
    project.updatedAt = message.createdAt;
    await this.persist();
    return message;
  }

  async deleteMessage(projectId: string, messageId: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);
    project.messages = project.messages.filter(message => message.id !== messageId);
    project.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async deleteProject(projectId: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);

    for (const fileId of project.fileIds) {
      const file = snapshot.files[fileId];
      if (file) {
        await this.options.fileSystem.deletePath(file.storagePath);
        delete snapshot.files[fileId];
      }
    }

    snapshot.sharedFileIds = snapshot.sharedFileIds.filter(
      fileId => !project.fileIds.includes(fileId),
    );
    snapshot.projects = snapshot.projects.filter(item => item.id !== projectId);

    if (snapshot.projects.length === 0) {
      const replacementProject = this.createProjectRecord('当前分享轮次');
      snapshot.projects.push(replacementProject);
      snapshot.activeProjectId = replacementProject.id;
    } else if (snapshot.activeProjectId === projectId) {
      snapshot.activeProjectId = snapshot.projects[0].id;
    }

    await this.persist();
  }

  async saveInboundFile(input: SaveInboundFileInput) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, input.projectId);
    const normalizedRelativePath = this.resolveRelativePath(
      snapshot,
      project,
      input.relativePath ?? input.name,
    );
    const originalSize = this.inputByteLength(input);
    const shouldCompress =
      originalSize < this.options.compressionThreshold &&
      shouldCompressInboundPayload(input.mimeType, normalizedRelativePath);
    const compression: CompressionMode = shouldCompress ? 'gzip' : 'none';
    const fileId = createId('file');
    const storagePath = `${this.options.rootDir}/projects/${project.id}/${fileId}${resolveStorageExtension(
      normalizedRelativePath,
      compression,
    )}`;

    await this.options.fileSystem.ensureDir(
      `${this.options.rootDir}/projects/${project.id}`,
    );
    const storedSize = await this.writeStoredFile(
      storagePath,
      input,
      compression,
      shouldCompress,
    );

    const fileRecord: SharedFileRecord = {
      id: fileId,
      projectId: project.id,
      displayName: this.fileNameFromRelativePath(normalizedRelativePath),
      relativePath: normalizedRelativePath,
      storagePath,
      compression,
      createdAt: new Date().toISOString(),
      mimeType: input.mimeType,
      originalSize,
      size: originalSize,
      storedSize,
      isLargeFile: !shouldCompress,
    };

    snapshot.files[fileId] = fileRecord;
    project.fileIds.push(fileId);
    project.updatedAt = fileRecord.createdAt;
    await this.persist();

    return fileRecord;
  }

  async addSharedFile(fileId: string) {
    const snapshot = await this.requireSnapshot();
    if (!snapshot.files[fileId]) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    if (!snapshot.sharedFileIds.includes(fileId)) {
      snapshot.sharedFileIds.push(fileId);
      await this.persist();
    }
  }

  async removeSharedFile(fileId: string) {
    const snapshot = await this.requireSnapshot();
    snapshot.sharedFileIds = snapshot.sharedFileIds.filter(id => id !== fileId);
    await this.persist();
  }

  async listProjectFiles(projectId?: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);

    return project.fileIds
      .map(fileId => snapshot.files[fileId])
      .filter(Boolean)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async deleteFile(fileId: string) {
    const snapshot = await this.requireSnapshot();
    const file = snapshot.files[fileId];
    if (!file) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    const project = this.resolveProject(snapshot, file.projectId);
    project.fileIds = project.fileIds.filter(id => id !== fileId);
    project.updatedAt = new Date().toISOString();
    snapshot.sharedFileIds = snapshot.sharedFileIds.filter(id => id !== fileId);
    delete snapshot.files[fileId];

    await this.options.fileSystem.deletePath(file.storagePath);
    await this.persist();
  }

  async listSharedFiles() {
    const snapshot = await this.requireSnapshot();
    return snapshot.sharedFileIds
      .map(fileId => snapshot.files[fileId])
      .filter(Boolean)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async prepareFileBytes(fileId: string) {
    const snapshot = await this.requireSnapshot();
    const file = snapshot.files[fileId];
    if (!file) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    const storedBytes = await this.options.fileSystem.readFile(file.storagePath);
    const restoredBytes =
      file.compression === 'gzip'
        ? await this.options.compression.decompress(storedBytes)
        : storedBytes;

    return {
      bytes: restoredBytes,
      file,
    };
  }

  async prepareFileChunk(
    fileId: string,
    offset: number,
    length: number,
  ): Promise<PreparedFileChunk> {
    const snapshot = await this.requireSnapshot();
    const file = snapshot.files[fileId];
    if (!file) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    const start = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
    const end = Math.min(file.size, start + safeLength);
    const contentLength = Math.max(0, end - start);

    if (contentLength === 0) {
      return {
        bytes: new Uint8Array(0),
        contentLength: 0,
        file,
        totalSize: file.size,
      } satisfies StoredFileChunk;
    }

    if (
      file.compression === 'none' &&
      this.options.fileSystem.readFileChunkBase64
    ) {
      return {
        base64: await this.options.fileSystem.readFileChunkBase64(
          file.storagePath,
          start,
          contentLength,
        ),
        contentLength,
        file,
        totalSize: file.size,
      } satisfies StoredFileChunk;
    }

    const prepared = await this.prepareFileBytes(fileId);
    return {
      bytes: prepared.bytes.slice(start, end),
      contentLength,
      file,
      totalSize: prepared.bytes.byteLength,
    } satisfies StoredFileChunk;
  }

  async cleanupTemporaryArtifacts() {
    const tempDirPath = this.tempDirPath();
    if (!(await this.options.fileSystem.exists(tempDirPath))) {
      return;
    }

    const tempEntries = await this.options.fileSystem.listFiles(tempDirPath);
    await Promise.all(
      tempEntries.map(entry =>
        this.options.fileSystem.deletePath(`${tempDirPath}/${entry}`),
      ),
    );
  }

  async beginInboundUpload(options: {
    mimeType?: string;
    name: string;
    relativePath: string;
    totalBytes: number;
  }): Promise<{uploadId: string}> {
    const name = options.name.trim();
    if (!name) {
      throw new Error('文件名不能为空。');
    }

    const totalBytes = options.totalBytes;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error('无效的文件大小。');
    }

    if (totalBytes > MAX_INBOUND_UPLOAD_TOTAL_BYTES) {
      throw new Error('文件超过当前会话允许的最大大小。');
    }

    await this.requireSnapshot();
    const uploadId = createId('up');
    const tempPath = `${this.tempDirPath()}/upload-${uploadId}.part`;
    await this.options.fileSystem.ensureDir(this.tempDirPath());
    await this.options.fileSystem.writeFile(tempPath, new Uint8Array(0));

    const relativePath = (options.relativePath?.trim() || name).replace(/\\/g, '/');
    this.pendingInboundUploads.set(uploadId, {
      mimeType: options.mimeType,
      name,
      receivedBytes: 0,
      relativePath,
      tempPath,
      totalBytes,
    });

    return {uploadId};
  }

  async appendInboundUpload(uploadId: string, body: unknown): Promise<void> {
    const pending = this.pendingInboundUploads.get(uploadId);
    if (!pending) {
      throw new Error('无效或已过期的上传会话。');
    }

    let chunkBytes = 0;

    if (isInboundBase64Chunk(body)) {
      chunkBytes =
        body.byteLength ?? inboundBase64ByteLength(body.base64);
      if (chunkBytes > MAX_INBOUND_UPLOAD_CHUNK_BYTES) {
        throw new Error('单个分块过大，请刷新页面后重试。');
      }

      if (!this.options.fileSystem.appendFileBase64) {
        throw new Error('当前环境不支持分块上传。');
      }

      await this.options.fileSystem.appendFileBase64(
        pending.tempPath,
        body.base64,
      );
    } else if (body instanceof Uint8Array) {
      chunkBytes = body.byteLength;
      if (chunkBytes > MAX_INBOUND_UPLOAD_CHUNK_BYTES) {
        throw new Error('单个分块过大，请刷新页面后重试。');
      }

      if (!this.options.fileSystem.appendFile) {
        throw new Error('当前环境不支持分块上传。');
      }

      await this.options.fileSystem.appendFile(pending.tempPath, body);
    } else {
      throw new Error('无效的分块数据。');
    }

    if (chunkBytes === 0) {
      return;
    }

    if (pending.receivedBytes + chunkBytes > pending.totalBytes) {
      throw new Error('已超出声明的文件总大小，上传已中止。');
    }

    pending.receivedBytes += chunkBytes;
  }

  async finalizeInboundUpload(uploadId: string): Promise<SharedFileRecord> {
    const pending = this.pendingInboundUploads.get(uploadId);
    if (!pending) {
      throw new Error('无效或已过期的上传会话。');
    }

    if (pending.receivedBytes !== pending.totalBytes) {
      throw new Error(
        `上传未完成：已接收 ${pending.receivedBytes} / ${pending.totalBytes} 字节。`,
      );
    }

    this.pendingInboundUploads.delete(uploadId);

    try {
      return await this.saveInboundFile({
        byteLength: pending.totalBytes,
        mimeType: pending.mimeType,
        name: pending.name,
        relativePath: pending.relativePath,
        sourcePath: pending.tempPath,
      });
    } finally {
      await this.options.fileSystem.deletePath(pending.tempPath).catch(() => {});
    }
  }

  async abortInboundUpload(uploadId: string): Promise<void> {
    const pending = this.pendingInboundUploads.get(uploadId);
    if (!pending) {
      return;
    }

    this.pendingInboundUploads.delete(uploadId);
    await this.options.fileSystem.deletePath(pending.tempPath).catch(() => {});
  }

  private async requireSnapshot() {
    await this.initialize();
    if (!this.snapshot) {
      throw new Error('Storage snapshot was not initialized');
    }

    return this.snapshot;
  }

  private createProjectRecord(title: string): ProjectRecord {
    const now = new Date().toISOString();
    return {
      id: createId('project'),
      title,
      createdAt: now,
      updatedAt: now,
      fileIds: [],
      messages: [],
    };
  }

  private resolveProject(snapshot: StorageSnapshot, projectId?: string) {
    const resolvedProjectId = projectId ?? snapshot.activeProjectId;
    const project = snapshot.projects.find(item => item.id === resolvedProjectId);
    if (!project) {
      throw new Error(`Unknown project: ${resolvedProjectId}`);
    }

    return project;
  }

  private resolveRelativePath(
    snapshot: StorageSnapshot,
    project: ProjectRecord,
    requestedRelativePath: string,
  ) {
    const normalized = requestedRelativePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');
    const fallbackPath = normalized || 'untitled.bin';
    const siblings = project.fileIds
      .map(fileId => snapshot.files[fileId])
      .filter(Boolean)
      .map(file => file.relativePath);

    if (!siblings.includes(fallbackPath)) {
      return fallbackPath;
    }

    const segments = fallbackPath.split('/');
    const fileName = segments.pop() ?? 'untitled.bin';
    const dotIndex = fileName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const extension = dotIndex > 0 ? fileName.slice(dotIndex) : '';
    const dirPrefix = segments.length > 0 ? `${segments.join('/')}/` : '';

    let attempt = 1;
    while (attempt < 1000) {
      const candidate = `${dirPrefix}${baseName} (${attempt})${extension}`;
      if (!siblings.includes(candidate)) {
        return candidate;
      }

      attempt += 1;
    }

    return `${dirPrefix}${baseName}-${createId('copy')}${extension}`;
  }

  private fileNameFromRelativePath(relativePath: string) {
    const segments = relativePath.split('/');
    return segments[segments.length - 1] ?? relativePath;
  }

  private async persist() {
    if (!this.snapshot) {
      return;
    }

    await this.options.fileSystem.writeText(
      this.snapshotFilePath(),
      JSON.stringify(this.snapshot, null, 2),
    );
  }

  private snapshotFilePath() {
    return `${this.options.rootDir}/${SNAPSHOT_FILE_NAME}`;
  }

  private tempDirPath() {
    return `${this.options.rootDir}/${TEMP_DIR_NAME}`;
  }

  private cloneSnapshot() {
    if (!this.snapshot) {
      throw new Error('Storage snapshot was not initialized');
    }

    return JSON.parse(JSON.stringify(this.snapshot)) as StorageSnapshot;
  }

  private async writeStoredFile(
    storagePath: string,
    input: SaveInboundFileInput,
    compression: CompressionMode,
    shouldCompress: boolean,
  ) {
    if (shouldCompress) {
      const sourceBytes = await this.resolveInputBytes(input);
      const storedBytes = await this.options.compression.compress(sourceBytes);
      await this.options.fileSystem.writeFile(storagePath, storedBytes);
      return storedBytes.byteLength;
    }

    if ('sourcePath' in input && this.options.fileSystem.copyFile) {
      await this.options.fileSystem.copyFile(input.sourcePath, storagePath);
      return input.byteLength;
    }

    if ('base64' in input && this.options.fileSystem.writeFileBase64) {
      await this.options.fileSystem.writeFileBase64(storagePath, input.base64);
      return input.byteLength;
    }

    const storedBytes =
      compression === 'none' ? await this.resolveInputBytes(input) : new Uint8Array(0);
    await this.options.fileSystem.writeFile(storagePath, storedBytes);
    return storedBytes.byteLength;
  }

  private inputByteLength(input: SaveInboundFileInput) {
    if ('bytes' in input) {
      return input.bytes.byteLength;
    }

    return input.byteLength;
  }

  private async resolveInputBytes(input: SaveInboundFileInput) {
    if ('bytes' in input) {
      return input.bytes;
    }

    if ('sourcePath' in input) {
      return this.options.fileSystem.readFile(input.sourcePath);
    }

    return decodeBase64(input.base64);
  }
}

function decodeBase64(value: string) {
  const bufferCtor = (
    globalThis as {
      Buffer?: {
        from(input: string, encoding: 'base64'): Uint8Array;
      };
    }
  ).Buffer;

  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(value, 'base64'));
  }

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error('Base64 decode is not available in this runtime.');
}

function isInboundBase64Chunk(
  value: unknown,
): value is {base64: string; byteLength?: number; kind: 'base64'} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {base64?: unknown; kind?: unknown};
  return (
    candidate.kind === 'base64' && typeof candidate.base64 === 'string'
  );
}

function inboundBase64ByteLength(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!sanitized) {
    return 0;
  }

  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return (sanitized.length / 4) * 3 - padding;
}

function shouldCompressInboundPayload(
  mimeType: string | undefined,
  relativePath: string,
) {
  const normalizedMimeType = mimeType?.toLowerCase();
  if (normalizedMimeType) {
    if (normalizedMimeType.startsWith('text/')) {
      return true;
    }

    if (
      normalizedMimeType === 'application/json' ||
      normalizedMimeType === 'application/ld+json' ||
      normalizedMimeType === 'application/xml' ||
      normalizedMimeType === 'application/javascript' ||
      normalizedMimeType === 'application/x-javascript' ||
      normalizedMimeType === 'application/x-www-form-urlencoded' ||
      normalizedMimeType === 'image/svg+xml'
    ) {
      return true;
    }

    return false;
  }

  const normalizedPath = relativePath.toLowerCase();
  return /\.(txt|md|markdown|csv|tsv|json|xml|html|htm|css|js|jsx|ts|tsx|mjs|cjs|yml|yaml|ini|conf|log|svg)$/i.test(
    normalizedPath,
  );
}

function resolveStorageExtension(
  relativePath: string,
  compression: CompressionMode,
) {
  if (compression === 'gzip') {
    return '.gz';
  }

  const normalizedPath = relativePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return '.bin';
  }

  const extension = fileName.slice(dotIndex).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(extension) ? extension : '.bin';
}
