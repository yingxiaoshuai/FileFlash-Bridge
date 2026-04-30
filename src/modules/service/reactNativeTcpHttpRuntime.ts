import {
  ServiceRuntime,
  ServiceRuntimeHandle,
  TransferRequest,
  TransferResponse,
  isTransferBase64Body,
} from './transferServiceController';

type TcpAddressLike = {
  address?: string;
  port?: number;
};

type TcpServerLike = {
  address?: () => TcpAddressLike | string | null;
  close(callback?: (error?: Error | null) => void): void;
  createConnection?: unknown;
  listen(
    options: {
      host: string;
      port: number;
      reuseAddress?: boolean;
    },
    callback?: () => void,
  ): TcpServerLike;
  listening?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type TcpSocketLike = {
  destroy(error?: Error): void;
  end(data?: string | Uint8Array): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  remoteAddress?: string;
  remotePort?: number;
  setNoDelay?: (enable?: boolean) => void;
  write(
    data: string | Uint8Array,
    encoding?: string,
    callback?: () => void,
  ): void;
};

type TcpSocketModule = {
  createServer(listener?: (socket: TcpSocketLike) => void): TcpServerLike;
  default?: TcpSocketModule;
};

const HEADER_DELIMITER = encodeUtf8('\r\n\r\n');

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
};

let cachedTcpSocketModule: TcpSocketModule | null | undefined;

function encodeUtf8(value: string) {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(value);
  }

  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function decodeAscii(bytes: Uint8Array) {
  let value = '';
  for (let index = 0; index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function decodeUtf8(bytes: Uint8Array) {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8').decode(bytes);
  }

  return decodeURIComponent(escape(decodeAscii(bytes)));
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }

  return combined;
}

function indexOfBytes(value: Uint8Array, needle: Uint8Array) {
  if (needle.byteLength === 0 || value.byteLength < needle.byteLength) {
    return -1;
  }

  outer: for (let start = 0; start <= value.byteLength - needle.byteLength; start += 1) {
    for (let offset = 0; offset < needle.byteLength; offset += 1) {
      if (value[start + offset] !== needle[offset]) {
        continue outer;
      }
    }

    return start;
  }

  return -1;
}

function toUint8Array(value: unknown) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (typeof value === 'string') {
    return encodeUtf8(value);
  }

  throw new Error('Unsupported TCP socket payload.');
}

function normalizeHeaders(headerLines: string[]) {
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

function readContentLength(value?: string) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid Content-Length header.');
  }

  return parsed;
}

function base64ToBytes(value: string) {
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

function resolveRequestBody(headers: Record<string, string>, bodyBytes: Uint8Array) {
  if (bodyBytes.byteLength === 0) {
    return undefined;
  }

  const contentType = headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(decodeUtf8(bodyBytes));
  }

  if (contentType.startsWith('text/')) {
    return decodeUtf8(bodyBytes);
  }

  return bodyBytes;
}

export function parseHttpRequestFrame(buffer: Uint8Array): {
  consumedBytes: number;
  request: Omit<TransferRequest, 'remoteAddress'>;
} | null {
  const headerEndIndex = indexOfBytes(buffer, HEADER_DELIMITER);
  if (headerEndIndex < 0) {
    return null;
  }

  const headerText = decodeAscii(buffer.slice(0, headerEndIndex));
  const [requestLine, ...headerLines] = headerText.split('\r\n');
  if (!requestLine) {
    throw new Error('Missing HTTP request line.');
  }

  const [method, target] = requestLine.split(' ');
  if (!method || !target) {
    throw new Error('Invalid HTTP request line.');
  }

  const headers = normalizeHeaders(headerLines);
  if (headers['transfer-encoding'] && !headers['content-length']) {
    throw new Error('Chunked request bodies are not supported by this runtime.');
  }

  const contentLength = readContentLength(headers['content-length']);
  const bodyStartIndex = headerEndIndex + HEADER_DELIMITER.byteLength;
  const bodyEndIndex = bodyStartIndex + contentLength;
  if (buffer.byteLength < bodyEndIndex) {
    return null;
  }

  const url = new URL(target, 'http://127.0.0.1');
  const bodyBytes = buffer.slice(bodyStartIndex, bodyEndIndex);

  return {
    consumedBytes: bodyEndIndex,
    request: {
      body: resolveRequestBody(headers, bodyBytes),
      headers,
      method: method.toUpperCase(),
      path: url.pathname,
      query: url.searchParams,
    },
  };
}

function resolveResponsePayload(response: TransferResponse) {
  const headers = {...(response.headers ?? {})};
  const body = response.body;

  if (!body) {
    return {
      bodyBytes: new Uint8Array(0),
      headers,
    };
  }

  if (isTransferBase64Body(body)) {
    if (!headers['content-length'] && body.byteLength != null) {
      headers['content-length'] = String(body.byteLength);
    }

    return {
      bodyBytes: base64ToBytes(body.base64),
      headers,
    };
  }

  if (body instanceof Uint8Array) {
    return {
      bodyBytes: body,
      headers,
    };
  }

  if (typeof body === 'string') {
    return {
      bodyBytes: encodeUtf8(body),
      headers,
    };
  }

  if (!headers['content-type']) {
    headers['content-type'] = 'application/json; charset=utf-8';
  }

  return {
    bodyBytes: encodeUtf8(JSON.stringify(body)),
    headers,
  };
}

export function encodeHttpResponse(response: TransferResponse) {
  const {bodyBytes, headers} = resolveResponsePayload(response);
  const finalHeaders = {...headers};

  if (!finalHeaders['content-length']) {
    finalHeaders['content-length'] = String(bodyBytes.byteLength);
  }

  if (!finalHeaders.connection) {
    finalHeaders.connection = 'close';
  }

  const statusText = STATUS_TEXT_BY_CODE[response.status] ?? 'OK';
  const headerText =
    `HTTP/1.1 ${response.status} ${statusText}\r\n` +
    Object.entries(finalHeaders)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n') +
    '\r\n\r\n';

  return concatBytes([encodeUtf8(headerText), bodyBytes]);
}

function loadTcpSocketModule() {
  if (cachedTcpSocketModule !== undefined) {
    return cachedTcpSocketModule;
  }

  try {
    const loaded = require('react-native-tcp-socket') as TcpSocketModule;
    cachedTcpSocketModule =
      loaded?.createServer != null
        ? loaded
        : loaded?.default?.createServer != null
          ? loaded.default
          : null;
  } catch {
    cachedTcpSocketModule = null;
  }

  return cachedTcpSocketModule;
}

function createMissingTcpSocketError() {
  return new Error(
    'HarmonyOS local transfer service requires react-native-tcp-socket and the Harmony template package to be installed.',
  );
}

function removeListener(
  emitter: {removeListener?: (event: string, listener: (...args: unknown[]) => void) => void},
  event: string,
  listener: (...args: unknown[]) => void,
) {
  emitter.removeListener?.(event, listener);
}

async function closeServer(server: TcpServerLike) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getServerPort(server: TcpServerLike, fallbackPort: number) {
  const address = server.address?.();
  if (address && typeof address !== 'string' && typeof address.port === 'number') {
    return address.port;
  }

  return fallbackPort;
}

export class ReactNativeTcpHttpRuntime implements ServiceRuntime {
  private activeSockets = new Set<TcpSocketLike>();

  private server?: TcpServerLike;

  async start(options: {
    handler: (request: TransferRequest) => Promise<TransferResponse>;
    port: number;
  }): Promise<ServiceRuntimeHandle> {
    const tcpSocket = loadTcpSocketModule();
    if (!tcpSocket?.createServer) {
      throw createMissingTcpSocketError();
    }

    if (this.server) {
      await this.stopServer(this.server);
    }

    const server = tcpSocket.createServer(socket => {
      this.activeSockets.add(socket);
      void this.handleSocket(socket, options.handler);
    });

    await new Promise<void>((resolve, reject) => {
      const handleError = (error?: unknown) => {
        removeListener(server, 'error', handleError);
        reject(error instanceof Error ? error : new Error('Failed to start TCP server.'));
      };

      server.on('error', handleError);
      server.listen(
        {
          host: '0.0.0.0',
          port: options.port,
          reuseAddress: true,
        },
        () => {
          removeListener(server, 'error', handleError);
          resolve();
        },
      );
    });

    this.server = server;
    const port = getServerPort(server, options.port);

    const handle: ServiceRuntimeHandle = {
      port,
      stop: async () => {
        if (this.server === server) {
          await this.stopServer(server);
        }
      },
    };

    return handle;
  }

  async isRunning() {
    return Boolean(this.server && (this.server.listening ?? true));
  }

  private async stopServer(server: TcpServerLike) {
    for (const socket of Array.from(this.activeSockets)) {
      try {
        socket.destroy();
      } catch {
        /* ignore socket shutdown failures */
      }
    }

    this.activeSockets.clear();
    await closeServer(server);

    if (this.server === server) {
      this.server = undefined;
    }
  }

  private async handleSocket(
    socket: TcpSocketLike,
    handler: (request: TransferRequest) => Promise<TransferResponse>,
  ) {
    socket.setNoDelay?.(true);

    let buffer = new Uint8Array(0);
    let processing = false;
    let responded = false;

    const finalize = () => {
      this.activeSockets.delete(socket);
    };

    const sendResponse = (response: TransferResponse) => {
      const payload = encodeHttpResponse(response);
      socket.write(payload, undefined, () => {
        socket.end();
      });
    };

    const processBuffer = async () => {
      if (processing || responded) {
        return;
      }

      processing = true;

      try {
        const parsedRequest = parseHttpRequestFrame(buffer);
        if (!parsedRequest) {
          return;
        }

        responded = true;
        buffer = buffer.slice(parsedRequest.consumedBytes);

        const response = await handler({
          ...parsedRequest.request,
          remoteAddress: socket.remoteAddress,
        });

        sendResponse(response);
      } catch (error) {
        responded = true;
        sendResponse({
          body: {
            code: 'SERVICE_STOPPED',
            message:
              error instanceof Error
                ? error.message
                : 'Unexpected Harmony HTTP runtime error.',
          },
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
          status: 500,
        });
      } finally {
        processing = false;
      }
    };

    socket.on('data', chunk => {
      if (responded) {
        return;
      }

      buffer = concatBytes([buffer, toUint8Array(chunk)]);
      void processBuffer();
    });

    socket.on('error', finalize);
    socket.on('close', finalize);
  }
}

export function createReactNativeTcpHttpRuntime() {
  return new ReactNativeTcpHttpRuntime();
}
