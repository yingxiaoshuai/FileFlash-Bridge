import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import {
  documentPickerErrorCodes,
  documentPickerTypes,
  isDocumentPickerErrorWithCode,
  pickDocuments,
  savePickedDocuments,
} from '../../platform/documentPicker';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { gzip, ungzip } from 'pako';

import { isHarmonyPlatform } from '../../platform/platform';
import {
  CompressionAdapter,
  FileSystemAdapter,
  InboundStorageGateway,
} from './inboundStorageGateway';
import { DEFAULT_SERVICE_CONFIG, SharedFileRecord } from '../service/models';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type NativeBytesLike =
  | Uint8Array
  | ArrayBuffer
  | ArrayBufferView
  | number[]
  | {
      buffer?: ArrayBuffer;
      byteLength?: number;
      byteOffset?: number;
      data?: number[];
      length?: number;
      [key: string]: unknown;
    };

type NativeFileAccessModule = {
  appendFile?: (path: string, content: Uint8Array | number[]) => Promise<void>;
  appendFileFromPath?: (path: string, sourcePath: string) => Promise<void>;
  copyFile?: (sourcePath: string, destinationPath: string) => Promise<void>;
  readFile?: (path: string) => Promise<NativeBytesLike>;
  readFileChunk?: (
    path: string,
    offset: number,
    length: number,
  ) => Promise<NativeBytesLike>;
  saveFileToDocuments?: (
    sourcePath: string,
    displayName?: string,
  ) => Promise<string>;
  writeFile?: (path: string, content: Uint8Array | number[]) => Promise<void>;
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
  error?: string;
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
const HARMONY_PENDING_SHARE_COPYING_PATH = `${RNFS.DocumentDirectoryPath}/ffb-inbound/copying.json`;
const HARMONY_PENDING_SHARE_CAPTURE_TIMEOUT_MS = 30 * 1000;
const HARMONY_PENDING_SHARE_CAPTURE_POLL_MS = 250;

const turboModuleRegistry = TurboModuleRegistry as
  | { get<T>(name: string): T | null }
  | undefined;

function isHarmonyFileAccessDiagnosticsEnabled() {
  return (
    isHarmonyPlatform() &&
    (globalThis as { __FILEFLASH_DIAGNOSTICS__?: boolean })
      .__FILEFLASH_DIAGNOSTICS__ === true
  );
}

function logHarmonyFileAccessDiagnostic(message: string, detail?: unknown) {
  if (!isHarmonyFileAccessDiagnosticsEnabled()) {
    return;
  }

  const suffix =
    detail instanceof Error ? ` ${detail.message}` : detail ? ` ${String(detail)}` : '';
  console.info(`[FPFileAccess] ${message}${suffix}`);
}

function getOptionalNativeModule<T>(name: string) {
  try {
    const nativeModule = (NativeModules as Record<string, T | undefined>)[name];
    if (nativeModule) {
      logHarmonyFileAccessDiagnostic(`${name} resolved from NativeModules`);
      return nativeModule;
    }
  } catch (error) {
    // Harmony throws from NativeModules when the ArkTS package is not present.
    logHarmonyFileAccessDiagnostic(`${name} NativeModules lookup failed`, error);
  }

  try {
    const turboModule = turboModuleRegistry?.get<T>(name) ?? undefined;
    if (turboModule) {
      logHarmonyFileAccessDiagnostic(`${name} resolved from TurboModuleRegistry`);
    } else {
      logHarmonyFileAccessDiagnostic(`${name} not found in TurboModuleRegistry`);
    }
    return turboModule;
  } catch (error) {
    logHarmonyFileAccessDiagnostic(
      `${name} TurboModuleRegistry lookup failed`,
      error,
    );
    return undefined;
  }
}

let cachedNativeFileAccess: NativeFileAccessModule | undefined;
let cachedNativeInboundSharing: NativeInboundSharingModule | undefined;

function getNativeFileAccess() {
  if (!cachedNativeFileAccess) {
    cachedNativeFileAccess =
      getOptionalNativeModule<NativeFileAccessModule>('FPFileAccess');
  }

  return cachedNativeFileAccess;
}

function getNativeInboundSharing() {
  if (!cachedNativeInboundSharing) {
    cachedNativeInboundSharing =
      getOptionalNativeModule<NativeInboundSharingModule>('FPInboundSharing');
  }

  return cachedNativeInboundSharing;
}

const BASE64_ENCODE_CHUNK_BYTES = 384 * 1024;

type Base64BufferCtor = {
  from(input: Uint8Array): { toString(encoding: 'base64'): string };
};

function getBase64BufferCtor() {
  return (globalThis as { Buffer?: Base64BufferCtor }).Buffer;
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
      index + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
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

function normalizeNativeBytes(value: NativeBytesLike) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value.data)) {
    return new Uint8Array(value.data);
  }

  if (value.buffer instanceof ArrayBuffer) {
    const byteOffset =
      typeof value.byteOffset === 'number' && Number.isFinite(value.byteOffset)
        ? value.byteOffset
        : 0;
    const byteLength =
      typeof value.byteLength === 'number' && Number.isFinite(value.byteLength)
        ? value.byteLength
        : value.buffer.byteLength - byteOffset;
    return new Uint8Array(value.buffer, byteOffset, byteLength);
  }

  if (typeof value.length === 'number' && Number.isFinite(value.length)) {
    const bytes = new Uint8Array(Math.max(0, value.length));
    for (let index = 0; index < bytes.byteLength; index += 1) {
      bytes[index] =
        Number((value as Record<string, unknown>)[String(index)]) || 0;
    }
    return bytes;
  }

  throw new Error('Native file access returned an invalid binary payload.');
}

function createMissingHarmonyFileAccessError() {
  return new Error(
    '当前鸿蒙安装包缺少 FPFileAccess 原生文件模块，请重新打包安装后再保存大文件。',
  );
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

function base64ToBytes(base64: string) {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (sanitized.length % 4 !== 0) {
    throw new Error('Invalid base64 payload.');
  }

  const padding = sanitized.endsWith('==')
    ? 2
    : sanitized.endsWith('=')
    ? 1
    : 0;
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

function bytesToNumberArray(bytes: Uint8Array) {
  const output = new Array<number>(bytes.byteLength);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output[index] = bytes[index];
  }
  return output;
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

    if (isHarmonyPlatform()) {
      const copyFile = getNativeFileAccess()?.copyFile;
      if (!copyFile) {
        throw createMissingHarmonyFileAccessError();
      }

      const sourceSize = await this.getFileSize(sourcePath).catch(
        () => undefined,
      );
      await copyFile(sourcePath, destinationPath);
      if (!(await RNFS.exists(destinationPath))) {
        throw new Error(
          `Stored file is missing after copy: ${destinationPath}`,
        );
      }

      const destinationSize = await this.getFileSize(destinationPath).catch(
        () => undefined,
      );
      if (
        sourceSize != null &&
        destinationSize != null &&
        destinationSize !== sourceSize
      ) {
        throw new Error(
          `Native file copy produced an incomplete file: ${destinationPath}`,
        );
      }
      return;
    }

    if (Platform.OS !== 'ios' && !isHarmonyPlatform()) {
      await RNFS.copyFile(sourcePath, destinationPath);
      return;
    }

    const sourceSize = await this.getFileSize(sourcePath).catch(
      () => undefined,
    );

    let copyError: unknown;
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
    } catch (error) {
      copyError = error;
    }

    const detail = copyError instanceof Error ? ` ${copyError.message}` : '';
    throw new Error(
      `Native file copy failed or produced an incomplete file:${detail}`,
    );
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

  async readFileChunk(path: string, offset: number, length: number) {
    if (isHarmonyPlatform()) {
      const readFileChunk = getNativeFileAccess()?.readFileChunk;
      if (!readFileChunk) {
        throw createMissingHarmonyFileAccessError();
      }

      return normalizeNativeBytes(await readFileChunk(path, offset, length));
    }

    const base64 = await RNFS.read(path, length, offset, 'base64');
    return base64ToBytes(base64);
  }

  async readFile(path: string) {
    if (isHarmonyPlatform()) {
      const readFile = getNativeFileAccess()?.readFile;
      if (!readFile) {
        throw createMissingHarmonyFileAccessError();
      }

      return normalizeNativeBytes(await readFile(path));
    }

    const base64 = await RNFS.readFile(path, 'base64');
    return base64ToBytes(base64);
  }

  async readText(path: string) {
    return RNFS.readFile(path, 'utf8');
  }

  async writeFile(path: string, content: Uint8Array) {
    await RNFS.mkdir(path.split('/').slice(0, -1).join('/'));

    if (isHarmonyPlatform()) {
      const writeFile = getNativeFileAccess()?.writeFile;
      if (!writeFile) {
        throw createMissingHarmonyFileAccessError();
      }

      await writeFile(path, bytesToNumberArray(content));
      return;
    }

    await RNFS.writeFile(path, await bytesToBase64Async(content), 'base64');
  }

  async appendFile(path: string, content: Uint8Array) {
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      await RNFS.mkdir(dir);
    }

    if (isHarmonyPlatform()) {
      const appendFile = getNativeFileAccess()?.appendFile;
      if (!appendFile) {
        throw createMissingHarmonyFileAccessError();
      }

      await appendFile(path, bytesToNumberArray(content));
      return;
    }

    await RNFS.appendFile(path, await bytesToBase64Async(content), 'base64');
  }

  async appendFileFromPath(path: string, sourcePath: string) {
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      await RNFS.mkdir(dir);
    }

    if (isHarmonyPlatform()) {
      const appendFileFromPath = getNativeFileAccess()?.appendFileFromPath;
      if (!appendFileFromPath) {
        throw createMissingHarmonyFileAccessError();
      }

      await appendFileFromPath(path, sourcePath);
      return;
    }

    const bytes = await this.readFile(sourcePath);
    await this.appendFile(path, bytes);
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
    compressionThreshold: isHarmonyPlatform()
      ? 0
      : DEFAULT_SERVICE_CONFIG.compressionThreshold,
    fileSystem: new ReactNativeFileSystemAdapter(),
    rootDir,
    sessionId,
  });
}

export interface ExportResult {
  destinationUri?: string;
  method: 'android-saf' | 'harmony-files' | 'ios-files' | 'share';
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

  const candidate = error as { code?: string; message?: string };
  return (
    (isDocumentPickerErrorWithCode(error) &&
      candidate.code === documentPickerErrorCodes.OPERATION_CANCELED) ||
    candidate.code === 'DOCUMENT_PICKER_CANCELED' ||
    candidate.code === 'E_PICKER_CANCELLED' ||
    /cancel/i.test(candidate.message ?? '')
  );
}

function normalizeFileUri(uri: string) {
  return uri.startsWith('file://')
    ? decodeURI(uri.slice('file://'.length))
    : uri;
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

async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function safePathExists(path: string) {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

async function waitForHarmonyPendingShareCapture() {
  if (await safePathExists(HARMONY_PENDING_SHARE_MANIFEST_PATH)) {
    return;
  }

  if (!(await safePathExists(HARMONY_PENDING_SHARE_COPYING_PATH))) {
    return;
  }

  const deadline = Date.now() + HARMONY_PENDING_SHARE_CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await delay(HARMONY_PENDING_SHARE_CAPTURE_POLL_MS);

    if (await safePathExists(HARMONY_PENDING_SHARE_MANIFEST_PATH)) {
      return;
    }

    if (!(await safePathExists(HARMONY_PENDING_SHARE_COPYING_PATH))) {
      return;
    }
  }
}

async function consumeHarmonyPendingSharedItems(): Promise<NativePendingSharedItems> {
  await waitForHarmonyPendingShareCapture();

  const exists = await safePathExists(HARMONY_PENDING_SHARE_MANIFEST_PATH);
  if (!exists) {
    return {
      files: [],
      texts: [],
    };
  }

  let parsed: NativePendingSharedItems | null = null;
  try {
    const rawManifest = await RNFS.readFile(
      HARMONY_PENDING_SHARE_MANIFEST_PATH,
      'utf8',
    );
    parsed = JSON.parse(rawManifest) as NativePendingSharedItems | null;
  } catch {
    throw new Error('Failed to read pending Harmony shared items.');
  } finally {
    await safeDeletePath(HARMONY_PENDING_SHARE_MANIFEST_PATH);
  }

  if (parsed?.error) {
    throw new Error(parsed.error);
  }

  return {
    files: Array.isArray(parsed?.files) ? parsed.files : [],
    texts: Array.isArray(parsed?.texts) ? parsed.texts : [],
  };
}

async function pickDocumentsForShare(
  requestedTypes: string[],
): Promise<ImportedDeviceFile[]> {
  try {
    const selectedFiles = await pickDocuments(
      isHarmonyPlatform()
        ? {
            allowMultiSelection: true,
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
    convertibleToMimeTypes?: Array<{ mimeType: string }>;
    isVirtual?: boolean;
    name: string | null;
    type?: string | null;
    uri: string;
  }>,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { keepLocalCopy } = require('@react-native-documents/picker') as {
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
  const pickMediaFiles = getNativeInboundSharing()?.pickMediaFiles;
  if (!pickMediaFiles) {
    throw new Error('当前设备暂不支持直接从图库导入。');
  }

  const files = await pickMediaFiles();
  return (files ?? []).map(file =>
    normalizeImportedDeviceFile(file, 'media picker'),
  );
}

export async function consumePendingSharedItems(): Promise<PendingSharedItems> {
  const consumeNativePendingSharedItems =
    getNativeInboundSharing()?.consumePendingSharedItems;
  const payload = consumeNativePendingSharedItems
    ? await consumeNativePendingSharedItems()
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

  await new ReactNativeFileSystemAdapter().writeFile(tempFilePath, bytes);

  try {
    if (isHarmonyPlatform()) {
      return await saveHarmonyFileToDocuments(file, tempFilePath);
    }

    await openShareSheet({
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
  await openShareSheet({
    failOnCancel: false,
    ...(isHarmonyPlatform() ? {} : { filename: file.displayName }),
    saveToFiles: Platform.OS === 'ios',
    type: file.mimeType,
    url: encodeURI(`file://${sourcePath}`),
  });

  return {
    method: Platform.OS === 'ios' ? 'ios-files' : 'share',
  };
}

type ShareOpenResultLike = {
  dismissedAction?: boolean;
  message?: string;
  success?: boolean;
};

async function openShareSheet(options: Parameters<typeof Share.open>[0]) {
  const result = (await Share.open(options)) as ShareOpenResultLike;

  if (result?.success === false) {
    const message = result.message?.trim();
    const isCancel =
      /cancel|cancelled|canceled|取消/i.test(message ?? '') ||
      (result.dismissedAction === true && !message);

    throw new Error(
      isCancel ? '已取消导出。' : message || '未能打开系统导出面板。',
    );
  }

  return result;
}

async function saveHarmonyFileToDocuments(
  file: SharedFileRecord,
  sourcePath: string,
): Promise<ExportResult> {
  const saveFileToDocuments = getNativeFileAccess()?.saveFileToDocuments;
  if (!saveFileToDocuments) {
    throw createMissingHarmonyFileAccessError();
  }

  const destinationUri = await saveFileToDocuments(
    sourcePath,
    file.displayName,
  );
  if (!destinationUri) {
    throw new Error('未能保存到本地文件。');
  }

  return {
    destinationUri,
    method: 'harmony-files',
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
  if (isHarmonyPlatform()) {
    return shareFromTemporaryFile(file, bytes);
  }

  if (Platform.OS === 'android') {
    const temporaryDirectory =
      RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
    if (!temporaryDirectory) {
      throw new Error('No temporary directory is available for export.');
    }

    const tempFilePath = `${temporaryDirectory}/ffb-export-${Date.now()}-${sanitizeFileName(
      file.displayName,
    )}`;
    await new ReactNativeFileSystemAdapter().writeFile(tempFilePath, bytes);

    try {
      return await saveToSystemDocumentUri(
        file,
        toEncodedFileUri(tempFilePath),
      );
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
  if (isHarmonyPlatform()) {
    return saveHarmonyFileToDocuments(file, file.storagePath);
  }

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
