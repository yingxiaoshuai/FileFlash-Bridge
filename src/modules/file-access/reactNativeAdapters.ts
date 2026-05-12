import {NativeModules, Platform} from 'react-native';
import {
  documentPickerErrorCodes,
  documentPickerTypes,
  isDocumentPickerErrorWithCode,
  pickDocuments,
  savePickedDocuments,
} from '../../platform/documentPicker';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {gzip, ungzip} from 'pako';

import {isHarmonyPlatform} from '../../platform/platform';
import {
  CompressionAdapter,
  FileSystemAdapter,
  InboundStorageGateway,
} from './inboundStorageGateway';
import {DEFAULT_SERVICE_CONFIG, SharedFileRecord} from '../service/models';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type NativeFileReaderModule = {
  readChunkBase64?: (
    filepath: string,
    offset: number,
    length: number,
  ) => Promise<string>;
};

type NativeImportedDeviceFile = {
  byteLength?: number;
  createdAt?: string;
  mimeType?: string;
  name?: string;
  relativePath?: string;
  sourcePath?: string;
};

type NativeImportedDeviceText = {
  content?: string;
  createdAt?: string;
};

type NativePendingSharedItems = {
  files?: NativeImportedDeviceFile[];
  texts?: NativeImportedDeviceText[];
};

type LocalCopyFile = {
  convertVirtualFileToType?: string;
  fileName: string;
  uri: string;
};

type NativeInboundSharingModule = {
  consumePendingSharedItems?: () => Promise<NativePendingSharedItems>;
  pickMediaFiles?: () => Promise<NativeImportedDeviceFile[]>;
};

const HARMONY_PENDING_SHARE_MANIFEST_PATH = `${RNFS.DocumentDirectoryPath}/ffb-inbound/pending.json`;

const nativeFileReader = NativeModules.FPFileReader as
  | NativeFileReaderModule
  | undefined;
const nativeInboundSharing = NativeModules.FPInboundSharing as
  | NativeInboundSharingModule
  | undefined;

const BASE64_ENCODE_CHUNK_BYTES = 384 * 1024;
const HARMONY_FILE_WRITE_CHUNK_BYTES = 128 * 1024;

type Base64BufferCtor = {
  from(input: Uint8Array): {toString(encoding: 'base64'): string};
};

function getBase64BufferCtor() {
  return (globalThis as {Buffer?: Base64BufferCtor}).Buffer;
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triple = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    output +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET[(triple >> 6) & 0x3f]
        : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }

  return output;
}

function bytesToBase64(bytes: Uint8Array) {
  const bufferCtor = getBase64BufferCtor();
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  return encodeBytesToBase64(bytes);
}

function waitForEventLoopTurn() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function getAlignedBase64ChunkEnd(start: number, totalLength: number) {
  const end = Math.min(totalLength, start + BASE64_ENCODE_CHUNK_BYTES);
  if (end >= totalLength) {
    return end;
  }

  const alignedEnd = end - ((end - start) % 3);
  return alignedEnd > start ? alignedEnd : end;
}

async function bytesToBase64Async(bytes: Uint8Array) {
  const bufferCtor = getBase64BufferCtor();
  if (
    bufferCtor &&
    (!isHarmonyPlatform() || bytes.byteLength <= BASE64_ENCODE_CHUNK_BYTES)
  ) {
    return bufferCtor.from(bytes).toString('base64');
  }

  if (bytes.byteLength <= BASE64_ENCODE_CHUNK_BYTES) {
    return bufferCtor
      ? bufferCtor.from(bytes).toString('base64')
      : encodeBytesToBase64(bytes);
  }

  const parts: string[] = [];
  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = getAlignedBase64ChunkEnd(offset, bytes.byteLength);
    const chunk = bytes.subarray(offset, end);
    parts.push(
      bufferCtor
        ? bufferCtor.from(chunk).toString('base64')
        : encodeBytesToBase64(chunk),
    );
    offset = end;
    if (offset < bytes.byteLength) {
      await waitForEventLoopTurn();
    }
  }

  return parts.join('');
}

async function writeBase64Chunks(
  content: Uint8Array,
  writeChunk: (contentBase64: string, isFirstChunk: boolean) => Promise<void>,
) {
  if (content.byteLength === 0) {
    await writeChunk('', true);
    return;
  }

  let offset = 0;
  let isFirstChunk = true;

  while (offset < content.byteLength) {
    const end = Math.min(
      content.byteLength,
      offset + HARMONY_FILE_WRITE_CHUNK_BYTES,
    );
    const contentBase64 = await bytesToBase64Async(content.subarray(offset, end));
    await writeChunk(contentBase64, isFirstChunk);

    offset = end;
    isFirstChunk = false;

    if (offset < content.byteLength) {
      await waitForEventLoopTurn();
    }
  }
}

function base64ToBytes(base64: string) {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (sanitized.length % 4 !== 0) {
    throw new Error('Invalid base64 payload.');
  }

  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  const byteLength = (sanitized.length / 4) * 3 - padding;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;

  for (let index = 0; index < sanitized.length; index += 4) {
    const first = sanitized[index];
    const second = sanitized[index + 1];
    const third = sanitized[index + 2];
    const fourth = sanitized[index + 3];
    const firstValue = BASE64_ALPHABET.indexOf(first);
    const secondValue = BASE64_ALPHABET.indexOf(second);
    const thirdValue = third === '=' ? 0 : BASE64_ALPHABET.indexOf(third);
    const fourthValue = fourth === '=' ? 0 : BASE64_ALPHABET.indexOf(fourth);

    if (
      firstValue < 0 ||
      secondValue < 0 ||
      (third !== '=' && thirdValue < 0) ||
      (fourth !== '=' && fourthValue < 0)
    ) {
      throw new Error('Invalid base64 payload.');
    }

    const triple =
      (firstValue << 18) |
      (secondValue << 12) |
      (thirdValue << 6) |
      fourthValue;

    bytes[byteIndex] = (triple >> 16) & 0xff;
    byteIndex += 1;

    if (third !== '=' && byteIndex < bytes.length) {
      bytes[byteIndex] = (triple >> 8) & 0xff;
      byteIndex += 1;
    }

    if (fourth !== '=' && byteIndex < bytes.length) {
      bytes[byteIndex] = triple & 0xff;
      byteIndex += 1;
    }
  }

  return bytes;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
}

export class ReactNativeFileSystemAdapter implements FileSystemAdapter {
  async copyFile(sourcePath: string, destinationPath: string) {
    const destinationDir = destinationPath.split('/').slice(0, -1).join('/');
    if (destinationDir) {
      await RNFS.mkdir(destinationDir);
    }

    if (Platform.OS !== 'ios' && !isHarmonyPlatform()) {
      await RNFS.copyFile(sourcePath, destinationPath);
      return;
    }

    const sourceSize = await this.getFileSize(sourcePath).catch(() => undefined);

    try {
      await RNFS.copyFile(sourcePath, destinationPath);
      if (await RNFS.exists(destinationPath)) {
        const destinationSize = await this.getFileSize(destinationPath).catch(
          () => undefined,
        );
        if (
          sourceSize == null ||
          destinationSize == null ||
          destinationSize === sourceSize
        ) {
          return;
        }
      }
    } catch {
      // Fall through to the read/write fallback below.
    }

    // Some iOS and Harmony RNFS copy flows can report success without leaving
    // a readable destination file behind. Recreate the destination deterministically.
    const contentBase64 = await RNFS.readFile(sourcePath, 'base64');
    await RNFS.writeFile(destinationPath, contentBase64, 'base64');
    if (!(await RNFS.exists(destinationPath))) {
      throw new Error(`Stored file is missing after copy: ${destinationPath}`);
    }
  }

  async deletePath(path: string) {
    const exists = await RNFS.exists(path);
    if (!exists) {
      return;
    }

    await RNFS.unlink(path);
  }

  async ensureDir(path: string) {
    await RNFS.mkdir(path);
  }

  async exists(path: string) {
    return RNFS.exists(path);
  }

  async getFileSize(path: string) {
    const stat = await RNFS.stat(path);
    return Number(stat.size) || 0;
  }

  async listFiles(path: string) {
    const items = await RNFS.readDir(path);
    return items.map(item => item.name);
  }

  async readFileChunkBase64(path: string, offset: number, length: number) {
    if (Platform.OS === 'ios') {
      const start = Number.isFinite(offset) ? Math.max(0, offset) : 0;
      const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
      if (safeLength === 0) {
        return '';
      }

      if (nativeFileReader?.readChunkBase64) {
        try {
          return await nativeFileReader.readChunkBase64(path, start, safeLength);
        } catch {
          // Fall back to a JS read so browser downloads still work if the
          // native reader rejects for a platform-specific file path.
        }
      }

      // Fallback only when the native module is unavailable, e.g. before the
      // app is rebuilt after adding the iOS chunk reader, or when a specific
      // native read path rejects and we can still recover in JS.
      const bytes = await this.readFile(path);
      const end = Math.min(bytes.byteLength, start + safeLength);
      return bytesToBase64(bytes.slice(start, end));
    }

    return RNFS.read(path, length, offset, 'base64');
  }

  async readFile(path: string) {
    const base64 = await RNFS.readFile(path, 'base64');
    return base64ToBytes(base64);
  }

  async readText(path: string) {
    return RNFS.readFile(path, 'utf8');
  }

  async writeFile(path: string, content: Uint8Array) {
    await RNFS.mkdir(path.split('/').slice(0, -1).join('/'));

    if (
      isHarmonyPlatform() &&
      content.byteLength > HARMONY_FILE_WRITE_CHUNK_BYTES
    ) {
      await writeBase64Chunks(content, async (contentBase64, isFirstChunk) => {
        if (isFirstChunk) {
          await RNFS.writeFile(path, contentBase64, 'base64');
        } else {
          await RNFS.appendFile(path, contentBase64, 'base64');
        }
      });
      return;
    }

    await RNFS.writeFile(path, await bytesToBase64Async(content), 'base64');
  }

  async appendFile(path: string, content: Uint8Array) {
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      await RNFS.mkdir(dir);
    }

    if (
      isHarmonyPlatform() &&
      content.byteLength > HARMONY_FILE_WRITE_CHUNK_BYTES
    ) {
      await writeBase64Chunks(content, async contentBase64 => {
        await RNFS.appendFile(path, contentBase64, 'base64');
      });
      return;
    }

    await RNFS.appendFile(path, await bytesToBase64Async(content), 'base64');
  }

  async appendFileBase64(path: string, contentBase64: string) {
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      await RNFS.mkdir(dir);
    }

    await RNFS.appendFile(path, contentBase64, 'base64');
  }

  async writeFileBase64(path: string, contentBase64: string) {
    await RNFS.mkdir(path.split('/').slice(0, -1).join('/'));
    await RNFS.writeFile(path, contentBase64, 'base64');
  }

  async writeText(path: string, content: string) {
    await RNFS.mkdir(path.split('/').slice(0, -1).join('/'));
    await RNFS.writeFile(path, content, 'utf8');
  }
}

export const reactNativeGzipCompression: CompressionAdapter = {
  async compress(content) {
    return gzip(content);
  },
  async decompress(content) {
    return ungzip(content);
  },
};

export function createReactNativeInboundStorageGateway(
  sessionId = DEFAULT_SERVICE_CONFIG.sessionId,
) {
  const rootDir = `${RNFS.DocumentDirectoryPath}/fileflash-bridge/${sessionId}`;

  return new InboundStorageGateway({
    compression: reactNativeGzipCompression,
    compressionThreshold: DEFAULT_SERVICE_CONFIG.compressionThreshold,
    fileSystem: new ReactNativeFileSystemAdapter(),
    rootDir,
    sessionId,
  });
}

export interface ExportResult {
  destinationUri?: string;
  method: 'android-saf' | 'ios-files' | 'share';
}

export interface ImportedDeviceFile {
  byteLength: number;
  cleanupPath?: string;
  createdAt?: string;
  mimeType?: string;
  name: string;
  relativePath: string;
  sourcePath: string;
}

export interface ImportedDeviceText {
  content: string;
  createdAt?: string;
}

export interface PendingSharedItems {
  files: ImportedDeviceFile[];
  texts: ImportedDeviceText[];
}

function isUserCancellation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {code?: string; message?: string};
  return (
    (isDocumentPickerErrorWithCode(error) &&
      candidate.code === documentPickerErrorCodes.OPERATION_CANCELED) ||
    candidate.code === 'DOCUMENT_PICKER_CANCELED' ||
    candidate.code === 'E_PICKER_CANCELLED' ||
    /cancel/i.test(candidate.message ?? '')
  );
}

function normalizeFileUri(uri: string) {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

function fileNameFromPath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || 'untitled.bin';
}

async function safeDeletePath(path: string) {
  try {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch {
    // Best effort cleanup for temporary picker copies.
  }
}

function normalizeImportedDeviceFile(
  file: NativeImportedDeviceFile,
  context: string,
): ImportedDeviceFile {
  const sourcePath = file.sourcePath?.trim();
  const name = file.name?.trim();
  const relativePath = file.relativePath?.trim() || name;
  const byteLength =
    typeof file.byteLength === 'number' && Number.isFinite(file.byteLength)
      ? file.byteLength
      : -1;

  if (!sourcePath || !name || !relativePath || byteLength < 0) {
    throw new Error(`Native ${context} returned an invalid file payload.`);
  }

  return {
    byteLength,
    cleanupPath: sourcePath,
    createdAt: file.createdAt,
    mimeType: file.mimeType ?? undefined,
    name,
    relativePath,
    sourcePath,
  };
}

function normalizeImportedDeviceText(
  text: NativeImportedDeviceText,
): ImportedDeviceText | null {
  const content = text.content?.trim();
  if (!content) {
    return null;
  }

  return {
    content,
    createdAt: text.createdAt,
  };
}

async function consumeHarmonyPendingSharedItems(): Promise<NativePendingSharedItems> {
  const exists = await RNFS.exists(HARMONY_PENDING_SHARE_MANIFEST_PATH);
  if (!exists) {
    return {
      files: [],
      texts: [],
    };
  }

  try {
    const rawManifest = await RNFS.readFile(
      HARMONY_PENDING_SHARE_MANIFEST_PATH,
      'utf8',
    );
    const parsed = JSON.parse(rawManifest) as NativePendingSharedItems | null;
    return {
      files: Array.isArray(parsed?.files) ? parsed.files : [],
      texts: Array.isArray(parsed?.texts) ? parsed.texts : [],
    };
  } catch {
    throw new Error('Failed to read pending Harmony shared items.');
  } finally {
    await safeDeletePath(HARMONY_PENDING_SHARE_MANIFEST_PATH);
  }
}

async function pickDocumentsForShare(
  requestedTypes: string[],
): Promise<ImportedDeviceFile[]> {
  try {
    const selectedFiles = await pickDocuments(
      isHarmonyPlatform()
        ? {
            allowMultiSelection: true,
            copyTo: 'cachesDirectory',
            type: requestedTypes,
          }
        : {
            allowMultiSelection: true,
            type: requestedTypes,
          },
    );
    const normalizedFiles = isHarmonyPlatform()
      ? selectedFiles
      : await copyPickedDocumentsToCache(selectedFiles);

    const importedFiles: ImportedDeviceFile[] = [];
    for (const file of normalizedFiles) {
      if (!file.fileCopyUri && !isHarmonyPlatform()) {
        throw new Error(
          `无法读取 ${file.name ?? '所选文件'}：${file.copyError}`,
        );
      }

      const sourceUri =
        file.fileCopyUri ?? (isHarmonyPlatform() ? file.uri : undefined);
      if (!sourceUri) {
        throw new Error('所选文件缺少可读取的本地路径。');
      }

      const normalizedPath = normalizeFileUri(sourceUri);
      const fileStat = await RNFS.stat(normalizedPath).catch(() => undefined);
      const pickerSize = 'size' in file ? file.size : undefined;
      const byteLength =
        Number(fileStat?.size) ||
        (typeof pickerSize === 'number' && Number.isFinite(pickerSize)
          ? pickerSize
          : 0);
      importedFiles.push({
        byteLength,
        cleanupPath: file.fileCopyUri ? normalizedPath : undefined,
        mimeType: file.type ?? undefined,
        name: file.name ?? fileNameFromPath(normalizedPath),
        relativePath: file.name ?? fileNameFromPath(normalizedPath),
        sourcePath: normalizedPath,
      });
    }

    return importedFiles;
  } catch (error) {
    if (isUserCancellation(error)) {
      throw new Error('已取消选择文件。');
    }

    throw error;
  }
}

async function copyPickedDocumentsToCache(
  selectedFiles: Array<{
    convertibleToMimeTypes?: Array<{mimeType: string}>;
    isVirtual?: boolean;
    name: string | null;
    type?: string | null;
    uri: string;
  }>,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {keepLocalCopy} = require('@react-native-documents/picker') as {
    keepLocalCopy: (options: {
      destination: 'cachesDirectory' | 'documentDirectory';
      files: [LocalCopyFile, ...LocalCopyFile[]];
    }) => Promise<
      Array<
        | {
            localUri: string;
            sourceUri: string;
            status: 'success';
          }
        | {
            copyError: string;
            sourceUri: string;
            status: 'error';
          }
      >
    >;
  };

  const filesToCopy = selectedFiles.map(file => ({
    fileName: file.name ?? fileNameFromPath(file.uri),
    ...(file.isVirtual && file.convertibleToMimeTypes?.[0]?.mimeType
      ? {
          convertVirtualFileToType: file.convertibleToMimeTypes[0].mimeType,
        }
      : {}),
    uri: file.uri,
  })) as [LocalCopyFile, ...LocalCopyFile[]];
  const localCopies = await keepLocalCopy({
    destination: 'cachesDirectory',
    files: filesToCopy,
  });
  const localCopiesBySourceUri = new Map(
    localCopies.map(localCopy => [localCopy.sourceUri, localCopy]),
  );

  return selectedFiles.map(file => {
    const localCopy = localCopiesBySourceUri.get(file.uri);
    return {
      ...file,
      copyError:
        localCopy?.status === 'error' ? localCopy.copyError : undefined,
      fileCopyUri:
        localCopy?.status === 'success' ? localCopy.localUri : undefined,
    };
  });
}

export async function pickDeviceFilesForShare(): Promise<ImportedDeviceFile[]> {
  return pickDocumentsForShare([documentPickerTypes.allFiles]);
}

export async function pickDeviceMediaForShare(): Promise<ImportedDeviceFile[]> {
  const pickMediaFiles = nativeInboundSharing?.pickMediaFiles;
  if (!pickMediaFiles) {
    throw new Error('当前设备暂不支持直接从图库导入。');
  }

  const files = await pickMediaFiles();
  return (files ?? []).map(file =>
    normalizeImportedDeviceFile(file, 'media picker'),
  );
}

export async function consumePendingSharedItems(): Promise<PendingSharedItems> {
  const payload = nativeInboundSharing?.consumePendingSharedItems
    ? await nativeInboundSharing.consumePendingSharedItems()
    : isHarmonyPlatform()
    ? await consumeHarmonyPendingSharedItems()
    : {
        files: [],
        texts: [],
      };

  return {
    files: (payload?.files ?? []).map(file =>
      normalizeImportedDeviceFile(file, 'share receiver'),
    ),
    texts: (payload?.texts ?? [])
      .map(normalizeImportedDeviceText)
      .filter((item): item is ImportedDeviceText => item != null),
  };
}

export async function cleanupImportedDeviceFiles(files: ImportedDeviceFile[]) {
  await Promise.all(
    files.map(file =>
      file.cleanupPath ? safeDeletePath(file.cleanupPath) : Promise.resolve(),
    ),
  );
}

async function shareFromTemporaryFile(
  file: SharedFileRecord,
  bytes: Uint8Array,
): Promise<ExportResult> {
  const temporaryDirectory =
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
  if (!temporaryDirectory) {
    throw new Error('No temporary directory is available for export.');
  }

  const tempFilePath = `${temporaryDirectory}/ffb-export-${Date.now()}-${sanitizeFileName(
    file.displayName,
  )}`;

  await RNFS.writeFile(tempFilePath, bytesToBase64(bytes), 'base64');

  try {
    await Share.open({
      failOnCancel: false,
      filename: file.displayName,
      saveToFiles: Platform.OS === 'ios',
      type: file.mimeType,
      url: `file://${tempFilePath}`,
    });

    return {
      method: Platform.OS === 'ios' ? 'ios-files' : 'share',
    };
  } finally {
    if (await RNFS.exists(tempFilePath)) {
      await RNFS.unlink(tempFilePath);
    }
  }
}

async function shareExistingFile(
  file: SharedFileRecord,
  sourcePath: string,
): Promise<ExportResult> {
  await Share.open({
    failOnCancel: false,
    filename: file.displayName,
    saveToFiles: Platform.OS === 'ios',
    type: file.mimeType,
    url: encodeURI(`file://${sourcePath}`),
  });

  return {
    method: Platform.OS === 'ios' ? 'ios-files' : 'share',
  };
}

function toEncodedFileUri(path: string) {
  return encodeURI(`file://${path}`);
}

async function saveToSystemDocumentUri(
  file: SharedFileRecord,
  sourceUri: string,
): Promise<ExportResult> {
  const [destination] = await savePickedDocuments({
    fileName: file.displayName,
    mimeType: file.mimeType ?? 'application/octet-stream',
    sourceUris: [sourceUri],
  });
  if (!destination?.uri) {
    throw new Error('No destination URI was returned by the system picker.');
  }
  if (destination.error) {
    throw new Error(destination.error);
  }
  return {
    destinationUri: destination.uri,
    method: 'android-saf',
  };
}

export async function exportPreparedFile(
  file: SharedFileRecord,
  bytes: Uint8Array,
) {
  if (Platform.OS === 'android') {
    const temporaryDirectory =
      RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
    if (!temporaryDirectory) {
      throw new Error('No temporary directory is available for export.');
    }

    const tempFilePath = `${temporaryDirectory}/ffb-export-${Date.now()}-${sanitizeFileName(
      file.displayName,
    )}`;
    await RNFS.writeFile(tempFilePath, bytesToBase64(bytes), 'base64');

    try {
      return await saveToSystemDocumentUri(file, toEncodedFileUri(tempFilePath));
    } catch (error) {
      if (isUserCancellation(error)) {
        throw new Error('已取消导出。');
      }

      return shareFromTemporaryFile(file, bytes);
    } finally {
      await safeDeletePath(tempFilePath);
    }
  }

  return shareFromTemporaryFile(file, bytes);
}

export async function exportStoredFile(file: SharedFileRecord) {
  if (Platform.OS === 'android') {
    try {
      return await saveToSystemDocumentUri(
        file,
        toEncodedFileUri(file.storagePath),
      );
    } catch (error) {
      if (isUserCancellation(error)) {
        throw new Error('已取消导出。');
      }

      return shareExistingFile(file, file.storagePath);
    }
  }

  return shareExistingFile(file, file.storagePath);
}
