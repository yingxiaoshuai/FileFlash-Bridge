import common from '@ohos.app.ability.common';
import fs, { ReadOptions, WriteOptions } from '@ohos.file.fs';
import picker from '@ohos.file.picker';
import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';

interface BytesObjectLike {
  buffer?: ArrayBuffer;
  byteLength?: number;
  byteOffset?: number;
  data?: number[];
}

type BytesLike = Uint8Array | ArrayBuffer | number[] | BytesObjectLike;

const FILE_COPY_CHUNK_BYTES = 1024 * 1024;

function normalizeFilePath(path: string): string {
  if (path.startsWith('file://')) {
    return decodeURI(path.substring('file://'.length));
  }

  return path;
}

function parentDir(path: string): string {
  const index = path.lastIndexOf('/');
  return index > 0 ? path.substring(0, index) : '';
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.substring(index + 1) : normalized;
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'untitled.bin';
}

function toUint8Array(bytes: BytesLike): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }

  if (Array.isArray(bytes)) {
    return new Uint8Array(bytes);
  }

  if (bytes.data && Array.isArray(bytes.data)) {
    return new Uint8Array(bytes.data);
  }

  if (bytes.buffer instanceof ArrayBuffer) {
    const byteOffset = typeof bytes.byteOffset === 'number' ? bytes.byteOffset : 0;
    const byteLength =
      typeof bytes.byteLength === 'number'
        ? bytes.byteLength
        : bytes.buffer.byteLength - byteOffset;
    return new Uint8Array(bytes.buffer, byteOffset, byteLength);
  }

  throw new Error('Invalid binary payload.');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

async function writeBufferFully(
  fd: number,
  buffer: ArrayBuffer,
  byteLength: number,
  offset: number,
): Promise<void> {
  let written = 0;

  while (written < byteLength) {
    const chunk =
      written === 0 && byteLength === buffer.byteLength
        ? buffer
        : buffer.slice(written, byteLength);
    const writeLength = await fs.write(fd, chunk, {
      length: byteLength - written,
      offset: offset + written,
    } as WriteOptions);

    if (writeLength <= 0) {
      throw new Error('Unable to write file chunk.');
    }

    written += writeLength;
  }
}

async function copyFileByChunks(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const source = fs.openSync(sourcePath, fs.OpenMode.READ_ONLY);
  const destination = fs.openSync(
    destinationPath,
    fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC,
  );
  const buffer = new ArrayBuffer(FILE_COPY_CHUNK_BYTES);
  let offset = 0;

  try {
    while (true) {
      const readLength = await fs.read(source.fd, buffer, {
        length: FILE_COPY_CHUNK_BYTES,
        offset,
      } as ReadOptions);

      if (readLength <= 0) {
        break;
      }

      await writeBufferFully(destination.fd, buffer, readLength, offset);
      offset += readLength;
    }

    await fs.fsync(destination.fd);
  } finally {
    fs.closeSync(source);
    fs.closeSync(destination);
  }
}

export class FPFileAccessTurboModule extends TurboModule {
  private readonly context: common.UIAbilityContext;

  constructor(ctx: TurboModuleContext) {
    super(ctx);
    this.context = ctx.uiAbilityContext;
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    const normalizedSource = normalizeFilePath(sourcePath);
    const normalizedDestination = normalizeFilePath(destinationPath);
    const dir = parentDir(normalizedDestination);
    if (dir) {
      await fs.mkdir(dir, true).catch(() => {});
    }

    await copyFileByChunks(normalizedSource, normalizedDestination);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const normalizedPath = normalizeFilePath(path);
    const file = fs.openSync(normalizedPath, fs.OpenMode.READ_ONLY);
    try {
      const size = fs.statSync(file.fd).size;
      const buffer = new ArrayBuffer(size);
      const readLength = fs.readSync(file.fd, buffer, {
        length: size,
        offset: 0,
      } as ReadOptions);
      return new Uint8Array(buffer.slice(0, readLength));
    } finally {
      fs.closeSync(file);
    }
  }

  async readFileChunk(
    path: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array> {
    const normalizedPath = normalizeFilePath(path);
    const file = fs.openSync(normalizedPath, fs.OpenMode.READ_ONLY);
    try {
      const size = fs.statSync(file.fd).size;
      const safeOffset = Math.max(0, Math.min(offset, size));
      const safeLength = Math.max(0, Math.min(length, size - safeOffset));
      if (safeLength === 0) {
        return new Uint8Array(0);
      }

      const buffer = new ArrayBuffer(safeLength);
      const readLength = fs.readSync(file.fd, buffer, {
        length: safeLength,
        offset: safeOffset,
      } as ReadOptions);
      return new Uint8Array(buffer.slice(0, readLength));
    } finally {
      fs.closeSync(file);
    }
  }

  async writeFile(path: string, content: BytesLike): Promise<void> {
    const normalizedPath = normalizeFilePath(path);
    const dir = parentDir(normalizedPath);
    if (dir) {
      await fs.mkdir(dir, true).catch(() => {});
    }

    const file = fs.openSync(
      normalizedPath,
      fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC,
    );
    try {
      const bytes = toUint8Array(content);
      await writeBufferFully(file.fd, toArrayBuffer(bytes), bytes.byteLength, 0);
      await fs.fsync(file.fd);
    } finally {
      fs.closeSync(file);
    }
  }

  async appendFile(path: string, content: BytesLike): Promise<void> {
    const normalizedPath = normalizeFilePath(path);
    const dir = parentDir(normalizedPath);
    if (dir) {
      await fs.mkdir(dir, true).catch(() => {});
    }

    const file = fs.openSync(
      normalizedPath,
      fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.APPEND,
    );
    try {
      const bytes = toUint8Array(content);
      await writeBufferFully(
        file.fd,
        toArrayBuffer(bytes),
        bytes.byteLength,
        fs.statSync(file.fd).size,
      );
      await fs.fsync(file.fd);
    } finally {
      fs.closeSync(file);
    }
  }

  async appendFileFromPath(path: string, sourcePath: string): Promise<void> {
    const normalizedPath = normalizeFilePath(path);
    const normalizedSource = normalizeFilePath(sourcePath);
    const dir = parentDir(normalizedPath);
    if (dir) {
      await fs.mkdir(dir, true).catch(() => {});
    }

    const source = fs.openSync(normalizedSource, fs.OpenMode.READ_ONLY);
    const destination = fs.openSync(
      normalizedPath,
      fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.APPEND,
    );
    const buffer = new ArrayBuffer(FILE_COPY_CHUNK_BYTES);
    let readOffset = 0;
    let writeOffset = fs.statSync(destination.fd).size;

    try {
      while (true) {
        const readLength = await fs.read(source.fd, buffer, {
          length: FILE_COPY_CHUNK_BYTES,
          offset: readOffset,
        } as ReadOptions);

        if (readLength <= 0) {
          break;
        }

        await writeBufferFully(destination.fd, buffer, readLength, writeOffset);
        readOffset += readLength;
        writeOffset += readLength;
      }

      await fs.fsync(destination.fd);
    } finally {
      fs.closeSync(source);
      fs.closeSync(destination);
    }
  }

  async saveFileToDocuments(
    sourcePath: string,
    displayName?: string,
  ): Promise<string> {
    const normalizedSource = normalizeFilePath(sourcePath);
    const safeName = sanitizeFileName(displayName || fileNameFromPath(normalizedSource));

    const options = new picker.DocumentSaveOptions();
    options.newFileNames = [safeName];

    const documentViewPicker = new picker.DocumentViewPicker(this.context);
    const uris = await documentViewPicker.save(options);
    if (!uris || uris.length === 0 || !uris[0]) {
      throw new Error('已取消导出。');
    }

    const destinationUri = uris[0];
    await copyFileByChunks(normalizedSource, destinationUri);
    return destinationUri;
  }
}
