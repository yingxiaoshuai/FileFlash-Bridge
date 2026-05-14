import {
  DEFAULT_SERVICE_CONFIG,
  CompressionMode,
  ProjectRecord,
  SecurityMode,
  SharedFileRecord,
  StorageSnapshot,
  TextMessage,
  createId,
} from '../service/models';
import {
  AppUiMetadata,
  WorkspaceOnboardingSnapshot,
  deriveWorkspaceOnboardingSnapshot,
} from '../onboarding/models';
import {
  AppLocale,
  DEFAULT_APP_LOCALE,
  resolveAppLocale,
} from '../localization/i18n';

export const SESSION_DELETION_WARNING =
  'Deleting will clear this session data and related files. Export files first if you need to keep them.';

export interface FileSystemAdapter {
  appendFile?(path: string, content: Uint8Array): Promise<void>;
  appendFileFromPath?(path: string, sourcePath: string): Promise<void>;
  copyFile?(sourcePath: string, destinationPath: string): Promise<void>;
  deletePath(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getFileSize?(path: string): Promise<number>;
  listFiles(path: string): Promise<string[]>;
  readFileChunk?(
    path: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array>;
  readFile(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
}

export interface CompressionAdapter {
  compress(content: Uint8Array): Promise<Uint8Array>;
  decompress(content: Uint8Array): Promise<Uint8Array>;
}

interface SaveInboundFileInputBase {
  createdAt?: string;
  mimeType?: string;
  name: string;
  projectId?: string;
  relativePath?: string;
}

interface SaveInboundBytesInput
  extends Omit<SaveInboundFileInputBase, 'bytes'> {
  bytes: Uint8Array;
}

interface SaveInboundPathInput extends Omit<SaveInboundFileInputBase, 'bytes'> {
  byteLength: number;
  sourcePath: string;
}

export type SaveInboundFileInput = SaveInboundBytesInput | SaveInboundPathInput;

export type InboundUploadBody =
  | Uint8Array
  | {
      byteLength: number;
      sourcePath: string;
    };

export interface InboundStorageGatewayOptions {
  compression: CompressionAdapter;
  compressionThreshold: number;
  fileSystem: FileSystemAdapter;
  rootDir: string;
  sessionId: string;
}

const SNAPSHOT_FILE_NAME = 'session-state.json';
const TEMP_DIR_NAME = 'temp';
const UI_METADATA_FILE_NAME = 'ui-state.json';

/** 单次 HTTP 分块体上限，避免原生服务将整段读入内存时 OOM。 */
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

type StoredFileChunk = {
  bytes: Uint8Array;
  contentLength: number;
  file: SharedFileRecord;
  sourceFile?: {
    length: number;
    offset: number;
    path: string;
  };
  totalSize: number;
};

export type PreparedFileChunk = StoredFileChunk;

type PrepareFileChunkOptions = {
  length: number;
  offset: number;
  preferSourceFile?: boolean;
};

export class InboundStorageGateway {
  private snapshot?: StorageSnapshot;

  private uiMetadata: AppUiMetadata = {};

  private readonly pendingInboundUploads = new Map<
    string,
    PendingInboundUpload
  >();

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

    await this.loadUiMetadata();

    await this.cleanupTemporaryArtifacts();
    await this.pruneMissingFiles();
    await this.reconcileStoredFileMetadata();

    return this.snapshot;
  }

  async getSnapshot() {
    await this.initialize();
    return this.cloneSnapshot();
  }

  async getWorkspaceOnboardingState(
    version: string,
  ): Promise<WorkspaceOnboardingSnapshot> {
    await this.initialize();
    return deriveWorkspaceOnboardingSnapshot(
      version,
      this.uiMetadata.workspaceOnboarding,
    );
  }

  async getLocalePreference(): Promise<AppLocale> {
    await this.initialize();
    return resolveAppLocale(this.uiMetadata.localePreference?.locale);
  }

  async setLocalePreference(
    locale: AppLocale,
    updatedAt = new Date().toISOString(),
  ): Promise<AppLocale> {
    await this.initialize();
    this.uiMetadata.localePreference = {
      locale,
      updatedAt,
    };
    await this.persistUiMetadata();
    return locale;
  }

  async getSecurityModePreference(): Promise<SecurityMode> {
    await this.initialize();
    return resolveSecurityModePreference(
      this.uiMetadata.securityModePreference?.securityMode,
    );
  }

  async setSecurityModePreference(
    securityMode: SecurityMode,
    updatedAt = new Date().toISOString(),
  ): Promise<SecurityMode> {
    await this.initialize();
    this.uiMetadata.securityModePreference = {
      securityMode,
      updatedAt,
    };
    await this.persistUiMetadata();
    return securityMode;
  }

  async recordManualWorkspaceOnboardingOpen(
    version: string,
    openedAt = new Date().toISOString(),
  ): Promise<WorkspaceOnboardingSnapshot> {
    await this.initialize();

    const currentRecord = this.uiMetadata.workspaceOnboarding;
    this.uiMetadata.workspaceOnboarding = {
      lastManualOpenAt: openedAt,
      status:
        currentRecord?.version === version ? currentRecord.status : undefined,
      updatedAt:
        currentRecord?.version === version
          ? currentRecord.updatedAt
          : undefined,
      version,
    };

    await this.persistUiMetadata();
    return this.getWorkspaceOnboardingState(version);
  }

  async markWorkspaceOnboardingSkipped(
    version: string,
    updatedAt = new Date().toISOString(),
  ): Promise<WorkspaceOnboardingSnapshot> {
    await this.initialize();
    const currentRecord = this.uiMetadata.workspaceOnboarding;
    const status =
      currentRecord?.version === version && currentRecord.status === 'completed'
        ? 'completed'
        : 'skipped';

    this.uiMetadata.workspaceOnboarding = {
      lastManualOpenAt:
        currentRecord?.version === version
          ? currentRecord.lastManualOpenAt
          : undefined,
      status,
      updatedAt,
      version,
    };

    await this.persistUiMetadata();
    return this.getWorkspaceOnboardingState(version);
  }

  async markWorkspaceOnboardingCompleted(
    version: string,
    updatedAt = new Date().toISOString(),
  ): Promise<WorkspaceOnboardingSnapshot> {
    await this.initialize();
    const currentRecord = this.uiMetadata.workspaceOnboarding;

    this.uiMetadata.workspaceOnboarding = {
      lastManualOpenAt:
        currentRecord?.version === version
          ? currentRecord.lastManualOpenAt
          : undefined,
      status: 'completed',
      updatedAt,
      version,
    };

    await this.persistUiMetadata();
    return this.getWorkspaceOnboardingState(version);
  }

  async createProject(title?: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.createProjectRecord(title ?? '新的分享轮次');
    snapshot.projects.unshift(project);
    snapshot.activeProjectId = project.id;
    snapshot.sharedFileIds = [];
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

  async renameProject(projectId: string, title: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('Project name cannot be empty.');
    }

    if (project.title === trimmedTitle) {
      return project;
    }

    project.title = trimmedTitle;
    project.updatedAt = new Date().toISOString();
    await this.persist();
    return project;
  }

  async appendTextMessage(
    content: string,
    projectId?: string,
    options?: { createdAt?: string; source?: 'browser' | 'app' },
  ) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);
    const createdAt = options?.createdAt ?? new Date().toISOString();
    const message: TextMessage = {
      id: createId('msg'),
      projectId: project.id,
      content,
      createdAt,
      source: options?.source ?? 'browser',
    };

    project.messages.push(message);
    project.updatedAt = createdAt;
    await this.persist();
    return message;
  }

  async deleteMessage(projectId: string, messageId: string) {
    const snapshot = await this.requireSnapshot();
    const project = this.resolveProject(snapshot, projectId);
    project.messages = project.messages.filter(
      message => message.id !== messageId,
    );
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
    const declaredOriginalSize = this.inputByteLength(input);
    const shouldCompress =
      declaredOriginalSize < this.options.compressionThreshold &&
      shouldCompressInboundPayload(input.mimeType, normalizedRelativePath);
    const compression: CompressionMode = shouldCompress ? 'gzip' : 'none';
    const fileId = createId('file');
    const createdAt = input.createdAt ?? new Date().toISOString();
    const storagePath = `${this.options.rootDir}/projects/${
      project.id
    }/${fileId}${resolveStorageExtension(normalizedRelativePath, compression)}`;

    await this.options.fileSystem.ensureDir(
      `${this.options.rootDir}/projects/${project.id}`,
    );
    let storedSize = 0;
    try {
      storedSize = await this.writeStoredFile(
        storagePath,
        input,
        compression,
        shouldCompress,
      );
      if (!(await this.options.fileSystem.exists(storagePath))) {
        throw new Error(`Stored file is missing after write: ${storagePath}`);
      }
    } catch (error) {
      await this.options.fileSystem.deletePath(storagePath).catch(() => {});
      throw error;
    }

    const logicalSize =
      compression === 'none' ? storedSize : declaredOriginalSize;
    const fileRecord: SharedFileRecord = {
      id: fileId,
      projectId: project.id,
      displayName: this.fileNameFromRelativePath(normalizedRelativePath),
      relativePath: normalizedRelativePath,
      storagePath,
      compression,
      createdAt,
      mimeType: input.mimeType,
      originalSize: logicalSize,
      size: logicalSize,
      storedSize,
      isLargeFile: !shouldCompress,
    };

    snapshot.files[fileId] = fileRecord;
    project.fileIds.push(fileId);
    project.updatedAt = createdAt;
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

    const storedBytes = await this.options.fileSystem.readFile(
      file.storagePath,
    );
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
    offsetOrOptions: number | PrepareFileChunkOptions,
    maybeLength?: number,
  ): Promise<PreparedFileChunk> {
    const snapshot = await this.requireSnapshot();
    const file = snapshot.files[fileId];
    if (!file) {
      throw new Error(`Unknown file: ${fileId}`);
    }

    const options =
      typeof offsetOrOptions === 'number'
        ? {
            length: maybeLength ?? 0,
            offset: offsetOrOptions,
          }
        : offsetOrOptions;
    const start = Number.isFinite(options.offset)
      ? Math.max(0, options.offset)
      : 0;
    const safeLength = Number.isFinite(options.length)
      ? Math.max(0, options.length)
      : 0;
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

    if (file.compression === 'none' && options.preferSourceFile) {
      const sourceFile = {
        length: contentLength,
        offset: start,
        path: file.storagePath,
      };

      return {
        bytes: new Uint8Array(0),
        contentLength,
        file,
        sourceFile,
        totalSize: file.size,
      } satisfies StoredFileChunk;
    }

    if (file.compression === 'none' && this.options.fileSystem.readFileChunk) {
      const bytes = await this.options.fileSystem.readFileChunk(
        file.storagePath,
        start,
        contentLength,
      );

      return {
        bytes,
        contentLength: bytes.byteLength,
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
  }): Promise<{ uploadId: string }> {
    const name = options.name.trim();
    if (!name) {
      throw new Error('File name cannot be empty.');
    }

    const totalBytes = options.totalBytes;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error('Invalid file size.');
    }

    if (totalBytes > MAX_INBOUND_UPLOAD_TOTAL_BYTES) {
      throw new Error('File exceeds the maximum size allowed for this session.');
    }

    await this.requireSnapshot();
    const uploadId = createId('up');
    const tempPath = `${this.tempDirPath()}/upload-${uploadId}.part`;
    await this.options.fileSystem.ensureDir(this.tempDirPath());
    await this.options.fileSystem.deletePath(tempPath).catch(() => {});

    const relativePath = (options.relativePath?.trim() || name).replace(
      /\\/g,
      '/',
    );
    this.pendingInboundUploads.set(uploadId, {
      mimeType: options.mimeType,
      name,
      receivedBytes: 0,
      relativePath,
      tempPath,
      totalBytes,
    });

    return { uploadId };
  }

  async appendInboundUpload(
    uploadId: string,
    body: InboundUploadBody,
    options?: {offset?: number},
  ): Promise<void> {
    const pending = this.pendingInboundUploads.get(uploadId);
    if (!pending) {
      throw new Error('Invalid or expired upload session.');
    }

    const isBytesBody = body instanceof Uint8Array;
    const isPathBody =
      !isBytesBody &&
      body !== null &&
      typeof body === 'object' &&
      typeof body.sourcePath === 'string' &&
      typeof body.byteLength === 'number';
    if (!isBytesBody && !isPathBody) {
      throw new Error('Invalid upload chunk data.');
    }

    const chunkBytes = isBytesBody
      ? body.byteLength
      : Math.max(0, Math.trunc(body.byteLength));
    if (chunkBytes === 0) {
      return;
    }

    if (chunkBytes > MAX_INBOUND_UPLOAD_CHUNK_BYTES) {
      throw new Error('Upload chunk is too large. Refresh the page and retry.');
    }

    const expectedOffset =
      typeof options?.offset === 'number' && Number.isFinite(options.offset)
        ? Math.trunc(options.offset)
        : undefined;
    if (expectedOffset != null) {
      if (expectedOffset < 0) {
        throw new Error('Invalid upload chunk offset.');
      }

      if (expectedOffset < pending.receivedBytes) {
        if (expectedOffset + chunkBytes <= pending.receivedBytes) {
          return;
        }

        throw new Error('Upload chunk overlaps already received data.');
      }

      if (expectedOffset > pending.receivedBytes) {
        throw new Error('Upload chunk offset is not contiguous.');
      }
    }

    if (pending.receivedBytes + chunkBytes > pending.totalBytes) {
      throw new Error('Upload exceeds the declared file size.');
    }

    if (isBytesBody) {
      if (!this.options.fileSystem.appendFile) {
        throw new Error('Chunked uploads are not supported in this environment.');
      }

      await this.options.fileSystem.appendFile(pending.tempPath, body);
    } else {
      if (!this.options.fileSystem.appendFileFromPath) {
        throw new Error('Path-based chunked uploads are not supported in this environment.');
      }

      await this.options.fileSystem.appendFileFromPath(
        pending.tempPath,
        body.sourcePath,
      );
    }

    pending.receivedBytes += chunkBytes;
  }


  async finalizeInboundUpload(uploadId: string): Promise<SharedFileRecord> {
    const pending = this.pendingInboundUploads.get(uploadId);
    if (!pending) {
      throw new Error('Invalid or expired upload session.');
    }

    if (pending.receivedBytes !== pending.totalBytes) {
      throw new Error(
        `Upload is incomplete: received ${pending.receivedBytes} / ${pending.totalBytes} bytes.`,
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
      await this.options.fileSystem
        .deletePath(pending.tempPath)
        .catch(() => {});
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
    const project = snapshot.projects.find(
      item => item.id === resolvedProjectId,
    );
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

  private uiMetadataFilePath() {
    return `${this.options.rootDir}/${UI_METADATA_FILE_NAME}`;
  }

  private tempDirPath() {
    return `${this.options.rootDir}/${TEMP_DIR_NAME}`;
  }

  private async pruneMissingFiles() {
    if (!this.snapshot) {
      return;
    }

    const missingFileIds: string[] = [];

    for (const [fileId, file] of Object.entries(this.snapshot.files)) {
      if (!(await this.options.fileSystem.exists(file.storagePath))) {
        missingFileIds.push(fileId);
      }
    }

    if (!missingFileIds.length) {
      return;
    }

    const missingFileIdSet = new Set(missingFileIds);
    for (const project of this.snapshot.projects) {
      const nextFileIds = project.fileIds.filter(
        fileId => !missingFileIdSet.has(fileId),
      );
      if (nextFileIds.length !== project.fileIds.length) {
        project.fileIds = nextFileIds;
        project.updatedAt = new Date().toISOString();
      }
    }

    this.snapshot.sharedFileIds = this.snapshot.sharedFileIds.filter(
      fileId => !missingFileIdSet.has(fileId),
    );

    for (const fileId of missingFileIds) {
      delete this.snapshot.files[fileId];
    }

    await this.persist();
  }

  private async reconcileStoredFileMetadata() {
    if (!this.snapshot || !this.options.fileSystem.getFileSize) {
      return;
    }

    let shouldPersist = false;

    for (const file of Object.values(this.snapshot.files)) {
      let actualStoredSize: number;
      try {
        actualStoredSize = await this.options.fileSystem.getFileSize(
          file.storagePath,
        );
      } catch {
        continue;
      }

      if (file.storedSize !== actualStoredSize) {
        file.storedSize = actualStoredSize;
        shouldPersist = true;
      }

      if (file.compression === 'none') {
        if (file.size !== actualStoredSize) {
          file.size = actualStoredSize;
          shouldPersist = true;
        }
        if (file.originalSize !== actualStoredSize) {
          file.originalSize = actualStoredSize;
          shouldPersist = true;
        }
      }
    }

    if (shouldPersist) {
      await this.persist();
    }
  }

  private cloneSnapshot() {
    if (!this.snapshot) {
      throw new Error('Storage snapshot was not initialized');
    }

    return JSON.parse(JSON.stringify(this.snapshot)) as StorageSnapshot;
  }

  private async loadUiMetadata() {
    const metadataPath = this.uiMetadataFilePath();
    if (!(await this.options.fileSystem.exists(metadataPath))) {
      this.uiMetadata = {
        localePreference: {
          locale: DEFAULT_APP_LOCALE,
        },
      };
      return;
    }

    const rawMetadata = await this.options.fileSystem.readText(metadataPath);
    const parsedMetadata = JSON.parse(rawMetadata) as AppUiMetadata;
    this.uiMetadata = {
      ...parsedMetadata,
      localePreference: {
        ...parsedMetadata.localePreference,
        locale: resolveAppLocale(parsedMetadata.localePreference?.locale),
      },
      securityModePreference: parsedMetadata.securityModePreference
        ? {
            ...parsedMetadata.securityModePreference,
            securityMode: resolveSecurityModePreference(
              parsedMetadata.securityModePreference.securityMode,
            ),
          }
        : undefined,
    };
  }

  private async persistUiMetadata() {
    await this.options.fileSystem.writeText(
      this.uiMetadataFilePath(),
      JSON.stringify(this.uiMetadata, null, 2),
    );
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
      if (this.options.fileSystem.getFileSize) {
        try {
          return await this.options.fileSystem.getFileSize(storagePath);
        } catch {
          throw new Error(`Stored file is missing after write: ${storagePath}`);
        }
      }
      return input.byteLength;
    }

    const storedBytes =
      compression === 'none'
        ? await this.resolveInputBytes(input)
        : new Uint8Array(0);
    await this.options.fileSystem.writeFile(storagePath, storedBytes);
    return storedBytes.byteLength;
  }

  private inputByteLength(input: SaveInboundFileInput) {
    if ('bytes' in input) {
      return input.bytes.byteLength;
    }

    return input.byteLength;
  }

  private async resolveInputBytes(
    input: SaveInboundFileInput,
  ): Promise<Uint8Array> {
    if ('bytes' in input) {
      return input.bytes;
    }

    if ('sourcePath' in input) {
      return this.options.fileSystem.readFile(input.sourcePath);
    }

    throw new Error('Invalid inbound file payload.');
  }
}

function resolveSecurityModePreference(value: unknown): SecurityMode {
  return value === 'simple' || value === 'secure'
    ? value
    : DEFAULT_SERVICE_CONFIG.securityMode;
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
