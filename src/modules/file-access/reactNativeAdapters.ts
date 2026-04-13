import {NativeModules, Platform} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {gzip, ungzip} from 'pako';

import {
  CompressionAdapter,
  FileSystemAdapter,
  InboundStorageGateway,
} from './inboundStorageGateway';
import {DEFAULT_SERVICE_CONFIG, SharedFileRecord} from '../service/models';

type AndroidDocumentPickerModule = {
  createDocument?: (
    suggestedName: string,
    mimeType?: string,
  ) => Promise<{uri?: string} | null>;
};

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array) {
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

  async listFiles(path: string) {
    const items = await RNFS.readDir(path);
    return items.map(item => item.name);
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
    await RNFS.writeFile(path, bytesToBase64(content), 'base64');
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
  bytes: Uint8Array;
  mimeType?: string;
  name: string;
  relativePath: string;
}

function isUserCancellation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {code?: string; message?: string};
  return (
    DocumentPicker.isCancel(error) ||
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

export async function pickDeviceFilesForShare(): Promise<ImportedDeviceFile[]> {
  try {
    const selectedFiles = await DocumentPicker.pick({
      allowMultiSelection: true,
      copyTo: 'cachesDirectory',
      type: [DocumentPicker.types.allFiles],
    });

    const importedFiles: ImportedDeviceFile[] = [];
    for (const file of selectedFiles) {
      if (file.copyError) {
        throw new Error(
          `无法读取 ${file.name ?? '所选文件'}：${file.copyError}`,
        );
      }

      const sourceUri = file.fileCopyUri ?? file.uri;
      if (!sourceUri) {
        throw new Error('所选文件缺少可读取的本地路径。');
      }

      // `copyTo: cachesDirectory` gives us a stable local file to read across providers,
      // then we immediately clean it up after importing into the session store.
      const normalizedPath = normalizeFileUri(sourceUri);
      const base64 = await RNFS.readFile(normalizedPath, 'base64');
      importedFiles.push({
        bytes: base64ToBytes(base64),
        mimeType: file.type ?? undefined,
        name: file.name ?? fileNameFromPath(normalizedPath),
        relativePath: file.name ?? fileNameFromPath(normalizedPath),
      });

      if (file.fileCopyUri) {
        await safeDeletePath(normalizedPath);
      }
    }

    return importedFiles;
  } catch (error) {
    if (isUserCancellation(error)) {
      throw new Error('已取消选择文件。');
    }

    throw error;
  }
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

async function saveToAndroidDocumentUri(
  file: SharedFileRecord,
  bytes: Uint8Array,
): Promise<ExportResult> {
  const documentPicker = NativeModules.RNDocumentPicker as
    | AndroidDocumentPickerModule
    | undefined;

  if (!documentPicker?.createDocument) {
    throw new Error('Android export picker is unavailable.');
  }

  const destination = await documentPicker.createDocument(
    file.displayName,
    file.mimeType ?? 'application/octet-stream',
  );
  if (!destination?.uri) {
    throw new Error('No destination URI was returned by the system picker.');
  }

  await RNFS.writeFile(destination.uri, bytesToBase64(bytes), 'base64');
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
    try {
      return await saveToAndroidDocumentUri(file, bytes);
    } catch (error) {
      if (isUserCancellation(error)) {
        throw new Error('已取消导出。');
      }

      return shareFromTemporaryFile(file, bytes);
    }
  }

  return shareFromTemporaryFile(file, bytes);
}
