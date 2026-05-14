import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { connection, socket } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import common from '@ohos.app.ability.common';
import fs, { WriteOptions } from '@ohos.file.fs';
import { util } from '@kit.ArkTS';

const EVENT_REQUEST = 'fpStaticServerRequest';
const HEADER_DELIMITER = new util.TextEncoder().encodeInto('\r\n\r\n');
const MAX_HTTP_HEADER_BYTES = 64 * 1024;
const MAX_BRIDGE_BODY_BYTES = 128 * 1024;
const MAX_UPLOAD_BODY_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60 * 1000;
const RESPONSE_WRITE_CHUNK_BYTES = 256 * 1024;
const SOCKET_CLOSE_GRACE_MS = 30;
const DEFAULT_PORT = 8668;
const UPLOAD_TEMP_DIR_NAME = 'fileflash-http-upload';

const STATUS_TEXT_BY_CODE: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  206: 'Partial Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

interface HttpRequestHeaderInfo {
  bodyStartIndex: number;
  contentLength: number;
  frameByteLength: number;
  headerEndIndex: number;
  headers: Record<string, string>;
  method: string;
  target: string;
}

interface NativeRequestBodyFile {
  byteLength: number;
  path: string;
}

interface NativeRequestPayload {
  bodyFile?: NativeRequestBodyFile;
  bodyBytes?: number[];
  bodyText?: string;
  headers: Record<string, string>;
  method: string;
  path: string;
  query: Record<string, string>;
  remoteAddress?: string;
  requestId: string;
}

interface NativeResponse {
  bodyBytes: Uint8Array;
  bodyFile?: NativeResponseBodyFile;
  headers: Record<string, string>;
  status: number;
}

interface NativeResponseBodyFile {
  length: number;
  offset: number;
  path: string;
}

interface ParsedTarget {
  path: string;
  query: Record<string, string>;
}

interface PendingResponse {
  reject: (error: Error) => void;
  resolve: (response: NativeResponse) => void;
  timeoutId: number;
}

interface NetworkAddressCandidate {
  address: string;
  interfaceName: string;
  rank: number;
}

function encodeUtf8(value: string): Uint8Array {
  return new util.TextEncoder().encodeInto(value);
}

function decodeAscii(bytes: Uint8Array): string {
  let value = '';
  for (let index = 0; index < bytes.byteLength; index++) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function decodeUtf8(bytes: Uint8Array): string {
  return util.TextDecoder.create('utf-8').decodeWithStream(bytes, {
    stream: false,
  });
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function indexOfBytesInParts(parts: Uint8Array[], needle: Uint8Array): number {
  if (needle.byteLength === 0) {
    return -1;
  }

  let absoluteIndex = 0;
  let matchedByteLength = 0;

  for (const part of parts) {
    for (let index = 0; index < part.byteLength; index++) {
      const byte = part[index];
      if (byte === needle[matchedByteLength]) {
        matchedByteLength++;
        if (matchedByteLength === needle.byteLength) {
          return absoluteIndex - needle.byteLength + 1;
        }
      } else {
        matchedByteLength = byte === needle[0] ? 1 : 0;
      }

      absoluteIndex++;
    }
  }

  return -1;
}

function copyByteRangeFromParts(
  parts: Uint8Array[],
  startIndex: number,
  endIndex: number,
): Uint8Array {
  const byteLength = Math.max(0, endIndex - startIndex);
  const bytes = new Uint8Array(byteLength);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (const part of parts) {
    const partStartIndex = sourceOffset;
    const partEndIndex = partStartIndex + part.byteLength;
    const overlapStartIndex = Math.max(startIndex, partStartIndex);
    const overlapEndIndex = Math.min(endIndex, partEndIndex);

    if (overlapStartIndex < overlapEndIndex) {
      const partOverlapStartIndex = overlapStartIndex - partStartIndex;
      const partOverlapEndIndex = overlapEndIndex - partStartIndex;
      const slice = part.subarray(partOverlapStartIndex, partOverlapEndIndex);
      bytes.set(slice, targetOffset);
      targetOffset += slice.byteLength;
    }

    sourceOffset = partEndIndex;
    if (sourceOffset >= endIndex) {
      break;
    }
  }

  return bytes;
}

function normalizeHeaders(headerLines: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of headerLines) {
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      headers[key] = value;
    }
  }

  return headers;
}

function readContentLength(value?: string): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid Content-Length header.');
  }

  return parsed;
}

function isByteBridgeBodyPath(path: string): boolean {
  return path === '/api/upload' || path === '/api/upload/part';
}

function parseHttpRequestHeaderBytes(
  headerBytes: Uint8Array,
  headerEndIndex: number,
): HttpRequestHeaderInfo {
  const headerText = decodeAscii(headerBytes);
  const headerLinesWithRequest = headerText.split('\r\n');
  const requestLine = headerLinesWithRequest[0];
  const headerLines = headerLinesWithRequest.slice(1);
  const requestParts = requestLine.split(' ');
  const method = requestParts[0];
  const target = requestParts[1];
  if (!method || !target) {
    throw new Error('Invalid HTTP request line.');
  }

  const headers = normalizeHeaders(headerLines);
  if (headers['transfer-encoding'] && !headers['content-length']) {
    throw new Error('Chunked request bodies are not supported.');
  }

  const contentLength = readContentLength(headers['content-length']);
  const bodyStartIndex = headerEndIndex + HEADER_DELIMITER.byteLength;

  return {
    bodyStartIndex,
    contentLength,
    frameByteLength: bodyStartIndex + contentLength,
    headerEndIndex,
    headers,
    method: method.toUpperCase(),
    target,
  };
}

function readHttpRequestHeaderFromParts(
  parts: Uint8Array[],
  bufferedByteLength: number,
): HttpRequestHeaderInfo | null {
  const headerEndIndex = indexOfBytesInParts(parts, HEADER_DELIMITER);
  if (headerEndIndex < 0) {
    if (bufferedByteLength > MAX_HTTP_HEADER_BYTES) {
      throw new Error('HTTP request header is too large.');
    }

    return null;
  }

  if (headerEndIndex > MAX_HTTP_HEADER_BYTES) {
    throw new Error('HTTP request header is too large.');
  }

  return parseHttpRequestHeaderBytes(
    copyByteRangeFromParts(parts, 0, headerEndIndex),
    headerEndIndex,
  );
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (_) {
    return value;
  }
}

function normalizeRequestTarget(target: string): string {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const schemeEndIndex = target.indexOf('://') + 3;
    const pathStartIndex = target.indexOf('/', schemeEndIndex);
    return pathStartIndex >= 0 ? target.slice(pathStartIndex) : '/';
  }

  return target || '/';
}

function parseTarget(target: string): ParsedTarget {
  const normalizedTarget = normalizeRequestTarget(target);
  const questionIndex = normalizedTarget.indexOf('?');
  const rawPath = questionIndex >= 0
    ? normalizedTarget.slice(0, questionIndex)
    : normalizedTarget;
  const rawQuery = questionIndex >= 0 ? normalizedTarget.slice(questionIndex + 1) : '';
  const query: Record<string, string> = {};

  if (rawQuery) {
    for (const item of rawQuery.split('&')) {
      if (!item) {
        continue;
      }

      const separatorIndex = item.indexOf('=');
      const rawKey = separatorIndex >= 0 ? item.slice(0, separatorIndex) : item;
      const rawValue = separatorIndex >= 0 ? item.slice(separatorIndex + 1) : '';
      const key = safeDecodeUriComponent(rawKey);
      if (key) {
        query[key] = safeDecodeUriComponent(rawValue);
      }
    }
  }

  const path = safeDecodeUriComponent(rawPath || '/');
  return {
    path: path.startsWith('/') ? path : `/${path}`,
    query,
  };
}

function isUtf8TextRequest(headers: Record<string, string>): boolean {
  const contentType = (headers['content-type'] ?? '').toLowerCase();
  return (
    contentType.includes('application/json') ||
    contentType.startsWith('text/') ||
    contentType.includes('charset=utf-8')
  );
}

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const normalizedHeaderName = headerName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === normalizedHeaderName) {
      return true;
    }
  }

  return false;
}

function sanitizeHeaderValue(value: string): string {
  return String(value).replace(/[\r\n]/g, ' ');
}

function cloneHeaders(input: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const key of Object.keys(input)) {
    headers[key] = input[key];
  }

  return headers;
}

function buildResponseHeaderBytes(response: NativeResponse): Uint8Array {
  const headers = cloneHeaders(response.headers);

  if (!hasHeader(headers, 'content-length')) {
    headers['content-length'] = String(response.bodyBytes.byteLength);
  }

  if (!hasHeader(headers, 'content-type')) {
    headers['content-type'] = 'application/octet-stream';
  }

  if (!hasHeader(headers, 'connection')) {
    headers.connection = 'close';
  }

  const statusText = STATUS_TEXT_BY_CODE[response.status] ?? 'OK';
  const headerLines: string[] = [`HTTP/1.1 ${response.status} ${statusText}`];
  for (const key of Object.keys(headers)) {
    headerLines.push(`${key}: ${sanitizeHeaderValue(headers[key])}`);
  }

  return encodeUtf8(`${headerLines.join('\r\n')}\r\n\r\n`);
}

function isUsableIPv4Address(address?: string): boolean {
  if (!address || address === '0.0.0.0' || address === '127.0.0.1') {
    return false;
  }

  return /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
}

function rankIPv4Address(interfaceName: string, address: string): number {
  if (/^192\.168\.(43|49|137)\./.test(address)) {
    return 40;
  }

  if (/wlan|wifi|wi-fi/i.test(interfaceName)) {
    return 30;
  }

  if (/bridge|ap|hotspot|tether/i.test(interfaceName)) {
    return 25;
  }

  if (/^(10|172\.(1[6-9]|2\d|3[0-1])|192\.168)\./.test(address)) {
    return 20;
  }

  return 10;
}

async function closeClient(client: socket.TCPSocketConnection): Promise<void> {
  try {
    await client.close();
  } catch (_) {
    // Ignore close failures; the peer may already be gone.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function toByteArray(bytes: Uint8Array): number[] {
  const output: number[] = new Array<number>(bytes.byteLength);
  for (let index = 0; index < bytes.byteLength; index++) {
    output[index] = bytes[index];
  }
  return output;
}

function parentDir(path: string): string {
  const index = path.lastIndexOf('/');
  return index > 0 ? path.substring(0, index) : '';
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
      throw new Error('Unable to write HTTP upload chunk.');
    }

    written += writeLength;
  }
}

async function sendBytes(
  client: socket.TCPSocketConnection,
  bytes: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = Math.min(offset + RESPONSE_WRITE_CHUNK_BYTES, bytes.byteLength);
    await client.send({
      data: toArrayBuffer(bytes.subarray(offset, end)),
    });
    offset = end;
  }
}

async function writeHttpResponse(
  client: socket.TCPSocketConnection,
  response: NativeResponse,
): Promise<void> {
  await sendBytes(client, buildResponseHeaderBytes(response));
  if (response.bodyFile) {
    await sendFileRange(client, response.bodyFile);
    return;
  }
  await sendBytes(client, response.bodyBytes);
}

async function sendFileRange(
  client: socket.TCPSocketConnection,
  source: NativeResponseBodyFile,
): Promise<void> {
  let remaining = Math.max(0, Math.trunc(Number(source.length)));
  let offset = Math.max(0, Math.trunc(Number(source.offset)));
  if (remaining === 0) {
    return;
  }

  const file = fs.openSync(source.path, fs.OpenMode.READ_ONLY);
  try {
    while (remaining > 0) {
      const length = Math.min(RESPONSE_WRITE_CHUNK_BYTES, remaining);
      const buffer = new ArrayBuffer(length);
      const readLength = await fs.read(file.fd, buffer, {
        length,
        offset,
      });
      if (readLength <= 0) {
        throw new Error('Unable to read HTTP response file.');
      }

      await client.send({
        data: readLength === buffer.byteLength ? buffer : buffer.slice(0, readLength),
      });
      offset += readLength;
      remaining -= readLength;
    }
  } finally {
    fs.closeSync(file);
  }
}

function createJsonErrorResponse(status: number, message: string): NativeResponse {
  return {
    bodyBytes: encodeUtf8(JSON.stringify({
      code: 'INVALID_REQUEST',
      message,
    })),
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    status,
  };
}

export class FPStaticServerTurboModule extends TurboModule {
  private readonly activeConnections: Map<number, socket.TCPSocketConnection> =
    new Map<number, socket.TCPSocketConnection>();
  private readonly pendingResponses: Map<string, PendingResponse> =
    new Map<string, PendingResponse>();
  private readonly context: common.UIAbilityContext;

  private keepAlive: boolean = false;
  private localhostOnly: boolean = false;
  private nextRequestNumber: number = 0;
  private port: number = DEFAULT_PORT;
  private server?: socket.TCPSocketServer;
  private url: string = '';

  constructor(ctx: TurboModuleContext) {
    super(ctx);
    this.context = ctx.uiAbilityContext;
  }

  async start(
    requestedPort: string,
    _root: string | null,
    localOnly: boolean,
    keepAlive: boolean,
  ): Promise<string> {
    if (this.server) {
      return this.currentOrigin();
    }

    this.port = this.resolveRequestedPort(requestedPort);
    this.localhostOnly = Boolean(localOnly);
    this.keepAlive = Boolean(keepAlive);

    const server = socket.constructTCPSocketServerInstance();
    this.server = server;

    const bindAddress: socket.NetAddress = {
      address: this.localhostOnly ? '127.0.0.1' : '0.0.0.0',
      family: 1,
      port: this.port,
    };

    server.on('connect', (client: socket.TCPSocketConnection) => {
      this.handleConnection(client);
    });
    server.on('error', (_error: BusinessError) => {
      // Per-connection errors are handled on each accepted client.
    });

    try {
      await server.listen(bindAddress);
      await this.applyServerOptions(server).catch(() => {});
      const localAddress = await server.getLocalAddress().catch(() => undefined);
      if (localAddress && typeof localAddress.port === 'number' && localAddress.port > 0) {
        this.port = localAddress.port;
      } else if (this.port <= 0) {
        this.port = DEFAULT_PORT;
      }

      this.url = this.currentOrigin();
      return this.url;
    } catch (error) {
      this.server = undefined;
      try {
        server.off('connect');
        server.off('error');
        await server.close();
      } catch (_) {
        // Ignore cleanup failures after a failed listen.
      }
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.url = '';
    this.port = DEFAULT_PORT;

    const requestIds = Array.from(this.pendingResponses.keys());
    for (const requestId of requestIds) {
      const pending = this.pendingResponses.get(requestId);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Native HTTP bridge stopped.'));
      this.pendingResponses.delete(requestId);
    }

    for (const client of Array.from(this.activeConnections.values())) {
      await closeClient(client);
    }
    this.activeConnections.clear();

    if (server) {
      try {
        server.off('connect');
        server.off('error');
        await server.close();
      } catch (_) {
        // Stop should be idempotent from JS.
      }
    }
  }

  async origin(): Promise<string> {
    return this.server ? this.currentOrigin() : '';
  }

  async isRunning(): Promise<boolean> {
    return this.server !== undefined;
  }

  respond(
    requestId: string,
    status: number,
    headers: Record<string, string>,
    bodyEncoding: string,
    body: string,
  ): void {
    const pending = this.pendingResponses.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingResponses.delete(requestId);

    pending.resolve({
      bodyBytes: this.decodeResponseBody(bodyEncoding, body),
      headers: headers ?? {},
      status: Math.trunc(Number(status)) || 500,
    });
  }

  respondBytes(
    requestId: string,
    status: number,
    headers: Record<string, string>,
    body: Uint8Array,
  ): void {
    const pending = this.pendingResponses.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingResponses.delete(requestId);

    pending.resolve({
      bodyBytes: body ?? new Uint8Array(0),
      headers: headers ?? {},
      status: Math.trunc(Number(status)) || 500,
    });
  }

  respondFile(
    requestId: string,
    status: number,
    headers: Record<string, string>,
    path: string,
    offset: number,
    length: number,
  ): void {
    const pending = this.pendingResponses.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingResponses.delete(requestId);

    pending.resolve({
      bodyBytes: new Uint8Array(0),
      bodyFile: {
        length: Math.max(0, Math.trunc(Number(length))),
        offset: Math.max(0, Math.trunc(Number(offset))),
        path,
      },
      headers: headers ?? {},
      status: Math.trunc(Number(status)) || 500,
    });
  }

  addListener(_eventName: string): void {
    // Required by NativeEventEmitter.
  }

  removeListeners(_count: number): void {
    // Required by NativeEventEmitter.
  }

  public __onDestroy__(): void {
    void this.stop();
  }

  private resolveRequestedPort(requestedPort: string): number {
    const parsed = Number(requestedPort);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 65535) {
      return Math.trunc(parsed);
    }

    return DEFAULT_PORT;
  }

  private async applyServerOptions(server: socket.TCPSocketServer): Promise<void> {
    await server.setExtraOptions({
      keepAlive: this.keepAlive,
      OOBInline: false,
      TCPNoDelay: true,
      receiveBufferSize: 1024 * 1024,
      reuseAddress: true,
      sendBufferSize: 1024 * 1024,
      socketTimeout: 120000,
    } as socket.TCPExtraOptions);
  }

  private currentOrigin(): string {
    const host = this.localhostOnly ? '127.0.0.1' : this.currentIPv4Address();
    this.url = `http://${host}:${this.port}`;
    return this.url;
  }

  private currentIPv4Address(): string {
    const candidates: NetworkAddressCandidate[] = [];

    try {
      const netHandles = connection.getAllNetsSync();
      for (const netHandle of netHandles) {
        const properties = connection.getConnectionPropertiesSync(netHandle);
        this.collectIPv4Candidates(candidates, properties);
      }
    } catch (_) {
      // Fall through to the default network lookup below.
    }

    try {
      if (connection.hasDefaultNetSync()) {
        const defaultNet = connection.getDefaultNetSync();
        this.collectIPv4Candidates(
          candidates,
          connection.getConnectionPropertiesSync(defaultNet),
        );
      }
    } catch (_) {
      // Fall through to loopback.
    }

    if (candidates.length === 0) {
      return '127.0.0.1';
    }

    candidates.sort((left, right) => right.rank - left.rank);
    return candidates[0].address;
  }

  private collectIPv4Candidates(
    candidates: NetworkAddressCandidate[],
    properties: connection.ConnectionProperties,
  ): void {
    const interfaceName = properties.interfaceName ?? '';
    for (const linkAddress of properties.linkAddresses ?? []) {
      const address = linkAddress?.address?.address;
      const family = linkAddress?.address?.family;
      if (!address || family === 2 || !isUsableIPv4Address(address)) {
        continue;
      }

      const existing = candidates.find(item => item.address === address);
      if (!existing) {
        candidates.push({
          address,
          interfaceName,
          rank: rankIPv4Address(interfaceName, address),
        });
      }
    }
  }

  private handleConnection(client: socket.TCPSocketConnection): void {
    this.activeConnections.set(client.clientId, client);

    let bufferParts: Uint8Array[] = [];
    let bufferedByteLength = 0;
    let needsProcess = false;
    let processing = false;
    let responded = false;
    let remoteAddress: string | undefined = undefined;

    const cleanup = () => {
      this.activeConnections.delete(client.clientId);
      try {
        client.off('message');
        client.off('close');
        client.off('error');
      } catch (_) {
        // Ignore listener cleanup failures.
      }
    };

    const appendBufferPart = (part: Uint8Array) => {
      if (part.byteLength === 0) {
        return;
      }

      bufferParts.push(part);
      bufferedByteLength += part.byteLength;
    };

    const cleanupBodyFile = async (payload: NativeRequestPayload) => {
      const path = payload.bodyFile?.path;
      if (!path) {
        return;
      }

      try {
        await fs.unlink(path);
      } catch (_) {
        // The request handler may have already moved or deleted it.
      }
    };

    const processBuffer = async () => {
      if (processing || responded) {
        return;
      }

      processing = true;
      try {
        const header = readHttpRequestHeaderFromParts(
          bufferParts,
          bufferedByteLength,
        );
        if (!header) {
          return;
        }

        const target = parseTarget(header.target);
        if (
          isByteBridgeBodyPath(target.path) &&
          header.contentLength > MAX_UPLOAD_BODY_BYTES
        ) {
          responded = true;
          bufferParts = [];
          bufferedByteLength = 0;
          await writeHttpResponse(
            client,
            createJsonErrorResponse(
              413,
              'Upload chunk is too large. Refresh the page and retry.',
            ),
          );
          return;
        }

        if (bufferedByteLength < header.frameByteLength) {
          return;
        }

        responded = true;

        let bodyBytes = new Uint8Array(0);
        let bodyFile: NativeRequestBodyFile | undefined = undefined;
        if (
          isByteBridgeBodyPath(target.path) &&
          header.contentLength > MAX_BRIDGE_BODY_BYTES
        ) {
          bodyFile = await this.writeRequestBodyToTempFile(
            bufferParts,
            header.bodyStartIndex,
            header.frameByteLength,
            header.contentLength,
          );
        } else {
          bodyBytes = copyByteRangeFromParts(
            bufferParts,
            header.bodyStartIndex,
            header.frameByteLength,
          );
        }
        bufferParts = [];
        bufferedByteLength = 0;

        const payload = this.createRequestPayload(
          header,
          bodyBytes,
          remoteAddress,
          bodyFile,
        );
        try {
          const response = await this.waitForResponse(payload);
          await writeHttpResponse(client, response);
        } finally {
          await cleanupBodyFile(payload);
        }
      } catch (error) {
        responded = true;
        const message =
          error instanceof Error ? error.message : 'Unexpected native HTTP failure.';
        await writeHttpResponse(client, createJsonErrorResponse(500, message));
      } finally {
        processing = false;
        if (responded) {
          await delay(SOCKET_CLOSE_GRACE_MS);
          await closeClient(client);
          cleanup();
        } else if (needsProcess) {
          needsProcess = false;
          void processBuffer();
        }
      }
    };

    client.on('message', (info: socket.SocketMessageInfo) => {
      remoteAddress = info.remoteInfo?.address ?? remoteAddress;
      if (responded) {
        return;
      }

      appendBufferPart(toUint8Array(info.message));
      if (processing) {
        needsProcess = true;
        return;
      }

      void processBuffer();
    });
    client.on('close', cleanup);
    client.on('error', (_error: BusinessError) => {
      cleanup();
    });
  }

  private createRequestPayload(
    header: HttpRequestHeaderInfo,
    bodyBytes: Uint8Array,
    remoteAddress?: string,
    bodyFile?: NativeRequestBodyFile,
  ): NativeRequestPayload {
    const target = parseTarget(header.target);
    const requestId = this.createRequestId();
    const payload: NativeRequestPayload = {
      headers: header.headers,
      method: header.method,
      path: target.path,
      query: target.query,
      requestId,
    };

    if (remoteAddress) {
      payload.remoteAddress = remoteAddress;
    }

    if (bodyFile) {
      payload.bodyFile = bodyFile;
    } else if (bodyBytes.byteLength > 0) {
      payload.bodyBytes = toByteArray(bodyBytes);
      if (isUtf8TextRequest(header.headers)) {
        payload.bodyText = decodeUtf8(bodyBytes);
      }
    }

    return payload;
  }

  private uploadTempDir(): string {
    return `${this.context.cacheDir}/${UPLOAD_TEMP_DIR_NAME}`;
  }

  private createUploadTempPath(): string {
    this.nextRequestNumber++;
    return `${this.uploadTempDir()}/request-${Date.now()}-${this.nextRequestNumber}.part`;
  }

  private async writeRequestBodyToTempFile(
    parts: Uint8Array[],
    startIndex: number,
    endIndex: number,
    contentLength: number,
  ): Promise<NativeRequestBodyFile> {
    const path = this.createUploadTempPath();
    const dir = parentDir(path);
    if (dir) {
      await fs.mkdir(dir, true).catch(() => {});
    }

    const file = fs.openSync(
      path,
      fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC,
    );
    let sourceOffset = 0;
    let writeOffset = 0;

    try {
      for (const part of parts) {
        const partStartIndex = sourceOffset;
        const partEndIndex = partStartIndex + part.byteLength;
        const overlapStartIndex = Math.max(startIndex, partStartIndex);
        const overlapEndIndex = Math.min(endIndex, partEndIndex);

        if (overlapStartIndex < overlapEndIndex) {
          const partOverlapStartIndex = overlapStartIndex - partStartIndex;
          const partOverlapEndIndex = overlapEndIndex - partStartIndex;
          const slice = part.subarray(partOverlapStartIndex, partOverlapEndIndex);
          await writeBufferFully(
            file.fd,
            toArrayBuffer(slice),
            slice.byteLength,
            writeOffset,
          );
          writeOffset += slice.byteLength;
        }

        sourceOffset = partEndIndex;
        if (sourceOffset >= endIndex) {
          break;
        }
      }

      await fs.fsync(file.fd);
    } finally {
      fs.closeSync(file);
    }

    if (writeOffset !== contentLength) {
      await fs.unlink(path).catch(() => {});
      throw new Error('Incomplete HTTP upload body.');
    }

    return {
      byteLength: writeOffset,
      path,
    };
  }

  private createRequestId(): string {
    this.nextRequestNumber++;
    return `harmony-${Date.now()}-${this.nextRequestNumber}`;
  }

  private waitForResponse(payload: NativeRequestPayload): Promise<NativeResponse> {
    return new Promise<NativeResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(payload.requestId);
        reject(new Error('Native request bridge timed out.'));
      }, REQUEST_TIMEOUT_MS);

      this.pendingResponses.set(payload.requestId, {
        reject,
        resolve,
        timeoutId,
      });

      try {
        this.ctx.rnInstance.emitDeviceEvent(EVENT_REQUEST, payload);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingResponses.delete(payload.requestId);
        reject(error instanceof Error ? error : new Error('Failed to emit request event.'));
      }
    });
  }

  private decodeResponseBody(bodyEncoding: string, body?: string): Uint8Array {
    if (!body || bodyEncoding === 'empty') {
      return new Uint8Array(0);
    }

    return encodeUtf8(body);
  }
}
