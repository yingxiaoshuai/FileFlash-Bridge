import type common from '@ohos.app.ability.common';
import type { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import fs from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import util from '@ohos.util';

const LOG_DOMAIN: number = 0x0000;
const LOG_TAG: string = 'FPInboundSharing';
const INBOX_DIR_NAME: string = 'ffb-inbound';
const MANIFEST_FILE_NAME: string = 'pending.json';
const STREAM_PARAM_KEY: string = 'ability.params.stream';

class PendingFile {
  byteLength: number = 0;
  createdAt: string = '';
  mimeType: string | undefined = undefined;
  name: string = '';
  relativePath: string = '';
  sourcePath: string = '';
}

class PendingText {
  content: string = '';
  createdAt: string = '';
}

class PendingManifest {
  files: Array<PendingFile> = new Array<PendingFile>();
  texts: Array<PendingText> = new Array<PendingText>();
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function sanitizeFileName(candidate: string): string {
  const trimmed: string = candidate.trim();
  const sanitized: string = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  if (sanitized.length > 0) {
    return sanitized;
  }
  return 'shared-item';
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getManifestDir(context: common.UIAbilityContext): string {
  return context.filesDir + '/' + INBOX_DIR_NAME;
}

function getManifestPath(context: common.UIAbilityContext): string {
  return getManifestDir(context) + '/' + MANIFEST_FILE_NAME;
}

function getImportRoot(context: common.UIAbilityContext): string {
  return context.cacheDir + '/' + INBOX_DIR_NAME;
}

function ensureDir(path: string): void {
  try {
    fs.accessSync(path);
  } catch {
    fs.mkdirSync(path);
  }
}

function writeUtf8File(path: string, content: string): void {
  const file = fs.openSync(
    path,
    fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC,
  );

  try {
    fs.writeSync(file.fd, content);
    fs.fsyncSync(file.fd);
  } finally {
    fs.closeSync(file);
  }
}

function guessFileNameFromUri(uriValue: string): string {
  const normalizedValue: string = uriValue.replace(/\\/g, '/');
  const parts: Array<string> = normalizedValue.split('?');
  const withoutQuery: string = parts.length > 0 ? parts[0] : normalizedValue;
  const lastSlashIndex: number = withoutQuery.lastIndexOf('/');
  const tail: string =
    lastSlashIndex >= 0 ? withoutQuery.substring(lastSlashIndex + 1) : withoutQuery;
  return sanitizeFileName(safeDecodeURIComponent(tail));
}

function fileNameFromUri(uriValue: string): string {
  try {
    const parsed = new fileUri.FileUri(uriValue);
    if (parsed.name.length > 0) {
      return sanitizeFileName(parsed.name);
    }
  } catch {
  }

  return guessFileNameFromUri(uriValue);
}

function normalizeShareUriToPath(uriValue: string): string {
  try {
    const parsed = new fileUri.FileUri(uriValue);
    if (parsed.path.length > 0) {
      return safeDecodeURIComponent(parsed.path);
    }
  } catch {
  }

  if (uriValue.startsWith('file://')) {
    return safeDecodeURIComponent(uriValue.substring('file://'.length));
  }

  return safeDecodeURIComponent(uriValue);
}

function guessMimeType(
  fileName: string,
  fallbackMimeType: string | undefined,
): string | undefined {
  if (fallbackMimeType != undefined && fallbackMimeType.length > 0 && fallbackMimeType !== '*/*') {
    return fallbackMimeType;
  }

  const dotIndex: number = fileName.lastIndexOf('.');
  if (dotIndex < 0) {
    return undefined;
  }

  const extension: string = fileName.substring(dotIndex).toLowerCase();
  switch (extension) {
    case '.aac':
      return 'audio/aac';
    case '.csv':
      return 'text/csv';
    case '.gif':
      return 'image/gif';
    case '.jpeg':
      return 'image/jpeg';
    case '.jpg':
      return 'image/jpeg';
    case '.json':
      return 'application/json';
    case '.m4a':
      return 'audio/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
      return 'video/mp4';
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.txt':
      return 'text/plain';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'video/webm';
    case '.webp':
      return 'image/webp';
    case '.zip':
      return 'application/zip';
    default:
      return undefined;
  }
}

function createPendingFile(
  byteLength: number,
  createdAt: string,
  mimeType: string | undefined,
  name: string,
  relativePath: string,
  sourcePath: string,
): PendingFile {
  const pendingFile: PendingFile = new PendingFile();
  pendingFile.byteLength = byteLength;
  pendingFile.createdAt = createdAt;
  pendingFile.mimeType = mimeType;
  pendingFile.name = name;
  pendingFile.relativePath = relativePath;
  pendingFile.sourcePath = sourcePath;
  return pendingFile;
}

function createPendingText(content: string, createdAt: string): PendingText {
  const pendingText: PendingText = new PendingText();
  pendingText.content = content;
  pendingText.createdAt = createdAt;
  return pendingText;
}

function containsString(values: Array<string>, candidate: string): boolean {
  let index: number = 0;
  while (index < values.length) {
    if (values[index] === candidate) {
      return true;
    }
    index += 1;
  }
  return false;
}

function appendUniqueString(values: Array<string>, candidate: string): void {
  const trimmed: string = candidate.trim();
  if (trimmed.length === 0) {
    return;
  }
  if (!containsString(values, trimmed)) {
    values.push(trimmed);
  }
}

function extractShareUris(want: Want): Array<string> {
  const uris: Array<string> = new Array<string>();

  if (want.uri != undefined && want.uri.trim().length > 0) {
    appendUniqueString(uris, want.uri);
  }

  const parameters: Record<string, Object> | undefined = want.parameters;
  if (parameters == undefined) {
    return uris;
  }

  const streamValue: Object | undefined = parameters[STREAM_PARAM_KEY];
  if (typeof streamValue === 'string') {
    appendUniqueString(uris, streamValue);
    return uris;
  }

  if (streamValue instanceof Array) {
    let index: number = 0;
    while (index < streamValue.length) {
      const item: Object = streamValue[index];
      if (typeof item === 'string') {
        appendUniqueString(uris, item);
      }
      index += 1;
    }
  }

  return uris;
}

function extractSharedTexts(want: Want, createdAt: string): Array<PendingText> {
  const parameters: Record<string, Object> | undefined = want.parameters;
  const texts: Array<PendingText> = new Array<PendingText>();
  if (parameters == undefined) {
    return texts;
  }

  const recognizedKeys: Array<string> = [
    'content',
    'link',
    'shareText',
    'subject',
    'summary',
    'text',
    'title',
    'url',
  ];
  const values: Array<string> = new Array<string>();
  const keys: Array<string> = Object.keys(parameters);

  let index: number = 0;
  while (index < keys.length) {
    const key: string = keys[index];
    if (key !== STREAM_PARAM_KEY) {
      const rawValue: Object | undefined = parameters[key];
      if (typeof rawValue === 'string') {
        const content: string = rawValue.trim();
        if (content.length > 0) {
          if (containsString(recognizedKeys, key)) {
            appendUniqueString(values, content);
          } else if (
            values.length === 0 &&
            want.type != undefined &&
            want.type.startsWith('text/') &&
            !key.startsWith('ability.')
          ) {
            appendUniqueString(values, content);
          }
        }
      }
    }
    index += 1;
  }

  index = 0;
  while (index < values.length) {
    texts.push(createPendingText(values[index], createdAt));
    index += 1;
  }

  return texts;
}

function copySharedUriToInbox(
  context: common.UIAbilityContext,
  sharedUri: string,
  createdAt: string,
  fallbackMimeType: string | undefined,
): PendingFile {
  const importRoot: string = getImportRoot(context);
  ensureDir(importRoot);

  const fileName: string = fileNameFromUri(sharedUri);
  const destinationPath: string =
    importRoot +
    '/' +
    Date.now().toString() +
    '-' +
    util.generateRandomUUID() +
    '-' +
    fileName;
  const sourcePath: string = normalizeShareUriToPath(sharedUri);

  fs.copyFileSync(sourcePath, destinationPath);
  const stat = fs.statSync(destinationPath);

  return createPendingFile(
    stat.size,
    createdAt,
    guessMimeType(fileName, fallbackMimeType),
    fileName,
    fileName,
    destinationPath,
  );
}

function writeManifest(
  context: common.UIAbilityContext,
  manifest: PendingManifest,
): void {
  ensureDir(getManifestDir(context));
  writeUtf8File(getManifestPath(context), JSON.stringify(manifest));
}

export function captureInboundWant(
  context: common.UIAbilityContext,
  want: Want,
): void {
  try {
    const createdAt: string = createTimestamp();
    const manifest: PendingManifest = new PendingManifest();
    const sharedUris: Array<string> = extractShareUris(want);
    const sharedTexts: Array<PendingText> = extractSharedTexts(want, createdAt);

    let index: number = 0;
    while (index < sharedUris.length) {
      manifest.files.push(
        copySharedUriToInbox(context, sharedUris[index], createdAt, want.type),
      );
      index += 1;
    }

    index = 0;
    while (index < sharedTexts.length) {
      manifest.texts.push(sharedTexts[index]);
      index += 1;
    }

    if (manifest.files.length === 0 && manifest.texts.length === 0) {
      return;
    }

    writeManifest(context, manifest);
  } catch {
    hilog.error(LOG_DOMAIN, LOG_TAG, 'Failed to capture shared want.');
  }
}
