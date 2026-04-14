import {NativeEventEmitter, NativeModules} from 'react-native';

import {
  ServiceRuntime,
  TransferBase64Body,
  ServiceRuntimeHandle,
  TransferRequest,
  TransferResponse,
  isTransferBase64Body,
} from './transferServiceController';

type NativeServerModule = {
  start: (
    port: string,
    root: string | null,
    localOnly: boolean,
    keepAlive: boolean,
  ) => Promise<string>;
  stop: () => Promise<void> | void;
  isRunning: () => Promise<boolean>;
  respond: (
    requestId: string,
    status: number,
    headers: Record<string, string>,
    bodyEncoding: 'empty' | 'text' | 'base64',
    body: string,
  ) => Promise<void> | void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

type NativeServerRequestEvent = {
  bodyBase64?: string;
  bodyText?: string;
  headers?: Record<string, string>;
  method: string;
  path: string;
  query?: Record<string, string>;
  remoteAddress?: string;
  requestId: string;
};

const REQUEST_EVENT = 'fpStaticServerRequest';

const nativeServer = NativeModules.FPStaticServer as NativeServerModule | undefined;

function bytesToBase64(bytes: Uint8Array) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triple = (first << 16) | (second << 8) | third;

    output += alphabet[(triple >> 18) & 0x3f];
    output += alphabet[(triple >> 12) & 0x3f];
    output += index + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '=';
    output += index + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
  }

  return output;
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

function bytesToUtf8(bytes: Uint8Array) {
  const bufferCtor = (
    globalThis as {
      Buffer?: {
        from(input: Uint8Array): {toString(encoding: 'utf8'): string};
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

function normalizeHeaders(headers?: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function buildQueryParams(query?: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    params.set(key, value);
  }

  return params;
}

function toNativeResponse(response: TransferResponse) {
  const headers = {...(response.headers ?? {})};
  const body = response.body;

  if (isTransferBase64Body(body)) {
    if (!headers['content-length'] && body.byteLength != null) {
      headers['content-length'] = String(body.byteLength);
    }

    return {
      body: body.base64,
      bodyEncoding: 'base64' as const,
      headers,
      status: response.status,
    };
  }

  if (body instanceof Uint8Array) {
    return {
      body: bytesToBase64(body),
      bodyEncoding: 'base64' as const,
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
  private readonly emitter?: NativeEventEmitter;

  private handleRequest?: (request: TransferRequest) => Promise<TransferResponse>;

  private listenerSubscription?: {remove(): void};

  private origin?: string;

  private port?: number;

  constructor(private readonly options: {keepAlive?: boolean} = {}) {
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

    return {
      port: this.port,
      stop: async () => {
        await nativeServer.stop();
      },
    };
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
        headers,
        method: event.method,
        path: event.path,
        query: buildQueryParams(event.query),
        remoteAddress: event.remoteAddress,
      });

      const nativeResponse = toNativeResponse(response);
      await nativeServer.respond(
        event.requestId,
        nativeResponse.status,
        nativeResponse.headers,
        nativeResponse.bodyEncoding,
        nativeResponse.body,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected native HTTP bridge failure.';

      await nativeServer.respond(
        event.requestId,
        500,
        {'content-type': 'application/json; charset=utf-8'},
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

function resolveRequestBody(
  headers: Record<string, string | undefined>,
  event: NativeServerRequestEvent,
) {
  const contentType = headers['content-type'] ?? '';

  if (contentType.includes('application/json')) {
    if (event.bodyText) {
      return JSON.parse(event.bodyText);
    }

    if (event.bodyBase64) {
      return JSON.parse(bytesToUtf8(base64ToBytes(event.bodyBase64)));
    }

    return undefined;
  }

  if (contentType.startsWith('text/') && typeof event.bodyText === 'string') {
    return event.bodyText;
  }

  if (!event.bodyBase64) {
    return event.bodyText;
  }

  return {
    base64: event.bodyBase64,
    byteLength:
      parseContentLength(headers['content-length']) ??
      base64ByteLength(event.bodyBase64),
    kind: 'base64',
  } satisfies TransferBase64Body;
}

function parseContentLength(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function base64ByteLength(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!sanitized) {
    return 0;
  }

  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return (sanitized.length / 4) * 3 - padding;
}
