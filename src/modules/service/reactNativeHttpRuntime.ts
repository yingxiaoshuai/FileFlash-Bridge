import {
  NativeEventEmitter,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';

import {
  ServiceRuntime,
  ServiceRuntimeHandle,
  TransferRequest,
  TransferResponse,
} from './transferServiceController';

type NativeServerModule = {
  start: (
    port: string,
    root: string | null,
    localOnly: boolean,
    keepAlive: boolean,
  ) => Promise<string>;
  origin?: () => Promise<string>;
  stop: () => Promise<void> | void;
  isRunning: () => Promise<boolean>;
  respond: (
    requestId: string,
    status: number,
    headers: Record<string, string>,
    bodyEncoding: 'empty' | 'text',
    body: string,
  ) => Promise<void> | void;
  respondBytes?: (
    requestId: string,
    status: number,
    headers: Record<string, string>,
    body: Uint8Array,
  ) => Promise<void> | void;
  respondFile?: (
    requestId: string,
    status: number,
    headers: Record<string, string>,
    path: string,
    offset: number,
    length: number,
  ) => Promise<void> | void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

type NativeServerRequestEvent = {
  bodyFile?: {
    byteLength?: number;
    path?: string;
  };
  bodyBytes?:
    | ArrayBuffer
    | ArrayBufferView
    | number[]
    | {
        data?: number[];
        length?: number;
        [key: string]: unknown;
      };
  bodyText?: string;
  headers?: Record<string, string>;
  method: string;
  path: string;
  query?: Record<string, string>;
  remoteAddress?: string;
  requestId: string;
};

type NativeResponsePayload =
  | {
      bodyBytes: Uint8Array;
      headers: Record<string, string>;
      status: number;
    }
  | {
      bodyFile: {
        length: number;
        offset: number;
        path: string;
      };
      headers: Record<string, string>;
      status: number;
    }
  | {
      body: string;
      bodyEncoding: 'empty' | 'text';
      headers: Record<string, string>;
      status: number;
    };

const REQUEST_EVENT = 'fpStaticServerRequest';

const turboModuleRegistry = TurboModuleRegistry as
  | { get<T>(name: string): T | null }
  | undefined;
const nativeServer = (NativeModules?.FPStaticServer ??
  turboModuleRegistry?.get<NativeServerModule>('FPStaticServer') ??
  undefined) as NativeServerModule | undefined;

function readNativeBodyBytes(value: NativeServerRequestEvent['bodyBytes']) {
  if (!value) {
    return undefined;
  }

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

  if (typeof value.length === 'number' && Number.isFinite(value.length)) {
    const bytes = new Uint8Array(Math.max(0, value.length));
    for (let index = 0; index < bytes.byteLength; index += 1) {
      bytes[index] = Number(value[String(index)] ?? 0) & 0xff;
    }
    return bytes;
  }

  return undefined;
}

function bytesToUtf8(bytes: Uint8Array) {
  const bufferCtor = (
    globalThis as {
      Buffer?: {
        from(input: Uint8Array): { toString(encoding: 'utf8'): string };
      };
    }
  ).Buffer;

  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('utf8');
  }

  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8').decode(bytes);
  }

  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return decodeURIComponent(escape(binary));
}

function textToUtf8(value: string) {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(value);
  }

  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    bytes[index] = encoded.charCodeAt(index);
  }
  return bytes;
}

function normalizeHeaders(headers?: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
}

function buildQueryParams(query?: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    params.set(key, value);
  }

  return params;
}

function toNativeResponse(response: TransferResponse): NativeResponsePayload {
  const headers = { ...(response.headers ?? {}) };
  const body = response.body;

  if (response.bodyFile) {
    return {
      bodyFile: response.bodyFile,
      headers,
      status: response.status,
    };
  }

  if (body instanceof Uint8Array) {
    return {
      bodyBytes: body,
      headers,
      status: response.status,
    };
  }

  if (typeof body === 'string') {
    return {
      body,
      bodyEncoding: 'text' as const,
      headers,
      status: response.status,
    };
  }

  if (body) {
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json; charset=utf-8';
    }

    return {
      body: JSON.stringify(body),
      bodyEncoding: 'text' as const,
      headers,
      status: response.status,
    };
  }

  return {
    body: '',
    bodyEncoding: 'empty' as const,
    headers,
    status: response.status,
  };
}

export class ReactNativeHttpRuntime implements ServiceRuntime {
  readonly supportsFileResponses = Boolean(nativeServer?.respondFile);

  private readonly emitter?: NativeEventEmitter;

  private handleRequest?: (
    request: TransferRequest,
  ) => Promise<TransferResponse>;

  private listenerSubscription?: { remove(): void };

  private origin?: string;

  private port?: number;

  constructor(private readonly options: { keepAlive?: boolean } = {}) {
    if (nativeServer) {
      this.emitter = new NativeEventEmitter(nativeServer as never);
    }
  }

  async start(options: {
    handler: (request: TransferRequest) => Promise<TransferResponse>;
    port: number;
  }): Promise<ServiceRuntimeHandle> {
    if (!nativeServer || !this.emitter) {
      throw new Error('Native HTTP runtime is unavailable.');
    }

    this.handleRequest = options.handler;

    if (!this.listenerSubscription) {
      this.listenerSubscription = this.emitter.addListener(
        REQUEST_EVENT,
        event => {
          void this.onNativeRequest(event as NativeServerRequestEvent);
        },
      );
    }

    const origin = await nativeServer.start(
      String(options.port),
      null,
      false,
      this.options.keepAlive ?? true,
    );

    this.origin = origin;
    const resolvedOrigin = new URL(origin);
    this.port = Number(resolvedOrigin.port) || options.port;

    const handle: ServiceRuntimeHandle = {
      origin,
      port: this.port,
      refreshOrigin: async () => {
        if (!nativeServer.origin) {
          return handle.origin;
        }

        const nextOrigin = await nativeServer.origin();
        if (!nextOrigin) {
          return handle.origin;
        }

        this.origin = nextOrigin;
        const nextResolvedOrigin = new URL(nextOrigin);
        this.port = Number(nextResolvedOrigin.port) || handle.port;
        handle.origin = nextOrigin;
        handle.port = this.port;
        return handle.origin;
      },
      stop: async () => {
        await nativeServer.stop();
      },
    };

    return handle;
  }

  async isRunning() {
    if (!nativeServer) {
      return false;
    }

    return nativeServer.isRunning();
  }

  private async onNativeRequest(event: NativeServerRequestEvent) {
    if (!nativeServer || !this.handleRequest) {
      return;
    }

    try {
      const headers = normalizeHeaders(event.headers);
      const requestBody = resolveRequestBody(headers, event);

      const response = await this.handleRequest({
        body: requestBody,
        bodyFile: resolveRequestBodyFile(event),
        headers,
        method: event.method,
        path: event.path,
        query: buildQueryParams(event.query),
        remoteAddress: event.remoteAddress,
      });

      const nativeResponse = toNativeResponse(response);
      if ('bodyFile' in nativeResponse) {
        if (!nativeServer.respondFile) {
          throw new Error(
            'Native HTTP runtime does not support file responses.',
          );
        }

        await nativeServer.respondFile(
          event.requestId,
          nativeResponse.status,
          nativeResponse.headers,
          nativeResponse.bodyFile.path,
          nativeResponse.bodyFile.offset,
          nativeResponse.bodyFile.length,
        );
      } else if ('bodyBytes' in nativeResponse) {
        if (!nativeServer.respondBytes) {
          throw new Error(
            'Native HTTP runtime does not support byte responses.',
          );
        }

        await nativeServer.respondBytes(
          event.requestId,
          nativeResponse.status,
          nativeResponse.headers,
          nativeResponse.bodyBytes,
        );
      } else {
        await nativeServer.respond(
          event.requestId,
          nativeResponse.status,
          nativeResponse.headers,
          nativeResponse.bodyEncoding,
          nativeResponse.body,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected native HTTP bridge failure.';

      await nativeServer.respond(
        event.requestId,
        500,
        { 'content-type': 'application/json; charset=utf-8' },
        'text',
        JSON.stringify({
          code: 'INVALID_REQUEST',
          message,
        }),
      );
    }
  }
}

export function createReactNativeHttpRuntime() {
  return new ReactNativeHttpRuntime({
    keepAlive: true,
  });
}

function resolveRequestBodyFile(event: NativeServerRequestEvent) {
  if (
    event.bodyFile &&
    typeof event.bodyFile.path === 'string' &&
    typeof event.bodyFile.byteLength === 'number' &&
    Number.isFinite(event.bodyFile.byteLength)
  ) {
    return {
      byteLength: Math.max(0, Math.trunc(event.bodyFile.byteLength)),
      path: event.bodyFile.path,
    };
  }

  return undefined;
}

function shouldPreserveRawBody(path: string) {
  return path === '/api/upload' || path === '/api/upload/part';
}

function resolveRequestBody(
  headers: Record<string, string | undefined>,
  event: NativeServerRequestEvent,
) {
  if (event.bodyFile) {
    return undefined;
  }

  const contentType = headers['content-type'] ?? '';
  const bodyBytes = readNativeBodyBytes(event.bodyBytes);

  if (shouldPreserveRawBody(event.path)) {
    if (bodyBytes) {
      return bodyBytes;
    }

    return typeof event.bodyText === 'string'
      ? textToUtf8(event.bodyText)
      : undefined;
  }

  if (contentType.includes('application/json')) {
    if (event.bodyText) {
      return JSON.parse(event.bodyText);
    }

    if (bodyBytes) {
      return JSON.parse(bytesToUtf8(bodyBytes));
    }

    return undefined;
  }

  if (
    event.path === '/api/text' &&
    contentType.startsWith('text/') &&
    typeof event.bodyText === 'string'
  ) {
    return event.bodyText;
  }

  if (bodyBytes) {
    return bodyBytes;
  }

  return event.bodyText;
}
