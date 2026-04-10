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
  deletePath(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(path: string): Promise<string[]>;
  readFile(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
}

export interface CompressionAdapter {
  compress(content: Uint8Array): Promise<Uint8Array>;
  decompress(content: Uint8Array): Promise<Uint8Array>;
}

export interface SaveInboundFileInput {
  bytes: Uint8Array;
  mimeType?: string;
  name: string;
  projectId?: string;
  relativePath?: string;
}

export interface InboundStorageGatewayOptions {
  compression: CompressionAdapter;
  compressionThreshold: number;
  fileSystem: FileSystemAdapter;
  rootDir: string;
  sessionId: string;
}

const SNAPSHOT_FILE_NAME = 'session-state.json';
const TEMP_DIR_NAME = 'temp';

export class InboundStorageGateway {
  private snapshot?: StorageSnapshot;

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
    const shouldCompress =
      input.bytes.byteLength < this.options.compressionThreshold;
    const compression: CompressionMode = shouldCompress ? 'gzip' : 'none';
    const storedBytes = shouldCompress
      ? await this.options.compression.compress(input.bytes)
      : input.bytes;
    const fileId = createId('file');
    const storagePath = `${this.options.rootDir}/projects/${project.id}/${fileId}${
      shouldCompress ? '.gz' : '.bin'
    }`;

    await this.options.fileSystem.ensureDir(
      `${this.options.rootDir}/projects/${project.id}`,
    );
    await this.options.fileSystem.writeFile(storagePath, storedBytes);

    const fileRecord: SharedFileRecord = {
      id: fileId,
      projectId: project.id,
      displayName: this.fileNameFromRelativePath(normalizedRelativePath),
      relativePath: normalizedRelativePath,
      storagePath,
      compression,
      createdAt: new Date().toISOString(),
      mimeType: input.mimeType,
      originalSize: input.bytes.byteLength,
      size: input.bytes.byteLength,
      storedSize: storedBytes.byteLength,
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
}
