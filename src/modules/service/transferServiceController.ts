import {InboundStorageGateway} from '../file-access/inboundStorageGateway';
import {buildPortalDocument} from '../portal/portalDocument';
import {
  ConnectionRegistry,
  authorizeRequest,
  buildAccessUrl,
  generateAccessKey,
} from '../security/accessControl';
import {NetworkInterfaceDescriptor, resolveNetworkSnapshot} from './networkResolver';
import {
  ActiveConnection,
  ServiceConfig,
  ServiceError,
  ServiceState,
  createInitialServiceState,
} from './models';

export interface TransferRequest {
  body?: unknown;
  headers: Record<string, string | undefined>;
  method: string;
  path: string;
  query: URLSearchParams;
  remoteAddress?: string;
}

export interface TransferResponse {
  body?: object | string | Uint8Array;
  headers?: Record<string, string>;
  status: number;
}

export interface ServiceRuntimeHandle {
  port: number;
  stop(): Promise<void>;
}

export interface ServiceRuntime {
  start(options: {
    handler: (request: TransferRequest) => Promise<TransferResponse>;
    port: number;
  }): Promise<ServiceRuntimeHandle>;
  isRunning(): Promise<boolean>;
}

export interface RuntimeRestoreResult {
  restored: boolean;
  state: ServiceState;
}

export interface TransferServiceControllerOptions {
  config: ServiceConfig;
  networkProvider: () => Promise<NetworkInterfaceDescriptor[]>;
  runtime?: ServiceRuntime;
  storage: InboundStorageGateway;
}

type NormalizedUploadFile = {
  bytes: Uint8Array;
  mimeType?: string;
  name: string;
  relativePath?: string;
};

export class TransferServiceController {
  private readonly connectionRegistry: ConnectionRegistry;

  private runtimeHandle?: ServiceRuntimeHandle;

  private state: ServiceState;

  constructor(private readonly options: TransferServiceControllerOptions) {
    const config =
      options.config.accessKey === 'replace-me'
        ? {
            ...options.config,
            accessKey: generateAccessKey(),
          }
        : options.config;

    this.connectionRegistry = new ConnectionRegistry(config.maxActiveConnections);
    this.state = createInitialServiceState(config);
  }

  async initialize() {
    const snapshot = await this.options.storage.initialize();
    this.state = {
      ...this.state,
      activeProjectId: snapshot.activeProjectId,
      sharedFileCount: snapshot.sharedFileIds.length,
    };
    return this.getState();
  }

  getState() {
    return {
      ...this.state,
      activeConnections: [...this.state.activeConnections],
    };
  }

  async start() {
    await this.initialize();
    const network = resolveNetworkSnapshot(await this.options.networkProvider());

    if (!network.reachable || !network.address) {
      this.setError({
        code: 'NETWORK_UNAVAILABLE',
        message: '当前网络无法被同一局域网中的设备访问，请切换到可用 Wi-Fi 或热点。',
        recoverable: true,
        suggestedAction: '切换网络后重试',
      });
      return this.getState();
    }

    try {
      if (this.options.runtime) {
        this.runtimeHandle = await this.options.runtime.start({
          handler: request => this.handleRequest(request),
          port: this.state.config.port,
        });
      }

      const accessUrl = buildAccessUrl(
        `http://${network.address}:${this.runtimeHandle?.port ?? this.state.config.port}`,
        this.state.config.securityMode,
        this.state.config.accessKey,
      );

      this.state = {
        ...this.state,
        phase: 'running',
        network,
        accessUrl,
        qrValue: accessUrl,
        error: undefined,
        activeConnections: this.connectionRegistry.snapshot(),
      };
      return this.getState();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '服务启动失败，请稍后重试。';
      this.setError({
        code: /EADDRINUSE/i.test(message) ? 'PORT_IN_USE' : 'SERVICE_STOPPED',
        message,
        recoverable: true,
        suggestedAction: '更换端口或停止占用该端口的服务',
      });
      return this.getState();
    }
  }

  async stop() {
    if (this.runtimeHandle) {
      await this.runtimeHandle.stop();
      this.runtimeHandle = undefined;
    }

    this.connectionRegistry.clear();
    this.state = {
      ...this.state,
      phase: 'stopped',
      accessUrl: undefined,
      qrValue: undefined,
      activeConnections: [],
      error: undefined,
    };
    return this.getState();
  }

  async restoreIfNeeded(): Promise<RuntimeRestoreResult> {
    if (!this.options.runtime || this.state.phase !== 'running') {
      return {
        restored: false,
        state: this.getState(),
      };
    }

    const runtimeIsRunning = await this.options.runtime.isRunning();
    if (runtimeIsRunning) {
      return {
        restored: false,
        state: this.getState(),
      };
    }

    this.runtimeHandle = undefined;
    const state = await this.start();
    return {
      restored: true,
      state,
    };
  }

  async refreshAddress() {
    const network = resolveNetworkSnapshot(await this.options.networkProvider());

    if (!network.reachable || !network.address) {
      this.setError({
        code: 'NETWORK_UNAVAILABLE',
        message: '没有探测到可被其他设备访问的地址，请检查当前 Wi-Fi 或热点连接。',
        recoverable: true,
        suggestedAction: '切换网络或重试刷新',
      });
      return this.getState();
    }

    const accessUrl = buildAccessUrl(
      `http://${network.address}:${this.runtimeHandle?.port ?? this.state.config.port}`,
      this.state.config.securityMode,
      this.state.config.accessKey,
    );

    this.state = {
      ...this.state,
      network,
      accessUrl,
      qrValue: accessUrl,
      error: {
        code: 'NETWORK_REFRESHED',
        message: '网络地址已刷新，旧地址应视为失效。',
        recoverable: true,
        suggestedAction: '使用新地址重新访问',
      },
    };
    return this.getState();
  }

  async setSecurityMode(mode: ServiceConfig['securityMode']) {
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        securityMode: mode,
      },
    };

    if (this.state.network.address) {
      await this.refreshAddress();
    }

    return this.getState();
  }

  async rotateAccessKey() {
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        accessKey: generateAccessKey(),
      },
    };

    if (this.state.network.address) {
      await this.refreshAddress();
    }

    return this.getState();
  }

  async handleRequest(request: TransferRequest): Promise<TransferResponse> {
    if (request.path === '/api/health' && request.method === 'GET') {
      return this.json(200, {ok: true});
    }

    const authorization = authorizeRequest(
      this.state.config.securityMode,
      this.state.config.accessKey,
      request.query.get('key'),
    );

    if (!authorization.ok) {
      if (request.path === '/') {
        return this.html(401, this.renderUnauthorizedPage(authorization.reason ?? '未授权'));
      }

      return this.json(401, {
        code: 'UNAUTHORIZED',
        message: authorization.reason,
      });
    }

    const connectionDecision = this.touchConnection(request);
    if (!connectionDecision.accepted) {
      return this.json(429, {
        code: 'SESSION_LIMIT_REACHED',
        message: connectionDecision.reason,
      });
    }

    try {
      if (request.path === '/' && request.method === 'GET') {
        return this.html(
          200,
          buildPortalDocument({
            chunkSize: this.state.config.chunkSize,
            deviceName: this.state.config.deviceName,
            securityMode: this.state.config.securityMode,
          }),
        );
      }

      if (request.path === '/api/status' && request.method === 'GET') {
        await this.syncStorageState();
        return this.json(200, {
          activeConnections: this.state.activeConnections.length,
          activeProjectId: this.state.activeProjectId,
          chunkSize: this.state.config.chunkSize,
          notice:
            this.state.config.securityMode === 'simple'
              ? '当前为简单模式，仅建议在可信 Wi-Fi 或热点使用。'
              : '当前为安全模式，链接和二维码已携带 key。',
          phase: this.state.phase,
          securityMode: this.state.config.securityMode,
          sharedFileCount: this.state.sharedFileCount,
        });
      }

      if (request.path === '/api/upload' && request.method === 'POST') {
        const files = this.resolveUploadFiles(request);
        if (!files.length) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: '请至少上传一个文件。',
          });
        }

        const results = [];
        for (const file of files) {
          const savedFile = await this.options.storage.saveInboundFile({
            bytes: file.bytes,
            mimeType: file.mimeType,
            name: file.name,
            relativePath: file.relativePath,
          });
          results.push(savedFile);
        }

        await this.syncStorageState();
        return this.json(200, {
          files: results,
          message: '文件已写入手机端 App 内会话存储。',
        });
      }

      if (request.path === '/api/text' && request.method === 'POST') {
        const text = decodeSubmittedText(request.body)?.trim();

        if (!text) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: '请先输入要提交的文本内容。',
          });
        }

        if (text.length > this.state.config.maxTextLength) {
          return this.json(413, {
            code: 'TEXT_TOO_LARGE',
            message: '文本内容超过当前服务允许的上限。',
          });
        }

        const message = await this.options.storage.appendTextMessage(text);
        const snapshot = await this.options.storage.getSnapshot();
        const activeProject = snapshot.projects.find(
          project => project.id === snapshot.activeProjectId,
        );
        await this.syncStorageState();
        return this.json(200, {
          activeProjectId: snapshot.activeProjectId,
          activeProjectTitle: activeProject?.title ?? '当前分享轮次',
          message,
        });
      }

      if (request.path === '/api/shared' && request.method === 'GET') {
        const files = await this.options.storage.listSharedFiles();
        await this.syncStorageState();
        return this.json(200, {
          files: files.map(file => ({
            displayName: file.displayName,
            id: file.id,
            isLargeFile: file.isLargeFile,
            mimeType: file.mimeType,
            size: file.size,
          })),
        });
      }

      const downloadMatch = request.path.match(/^\/api\/shared\/([^/]+)\/download$/);
      if (downloadMatch && request.method === 'GET') {
        const fileId = downloadMatch[1];
        const offset = Number(request.query.get('offset') ?? '0');
        const length = Number(request.query.get('length') ?? `${this.state.config.chunkSize}`);
        const prepared = await this.options.storage.prepareFileBytes(fileId);
        const start = Number.isFinite(offset) ? Math.max(0, offset) : 0;
        const end = Math.min(prepared.bytes.byteLength, start + length);
        const chunk = prepared.bytes.slice(start, end);

        return {
          body: chunk,
          headers: {
            'content-disposition': `attachment; filename="${encodeURIComponent(
              prepared.file.displayName,
            )}"`,
            'content-length': String(chunk.byteLength),
            'content-type':
              prepared.file.mimeType ?? 'application/octet-stream',
            'x-file-size': String(prepared.file.size),
          },
          status:
            start === 0 && end === prepared.bytes.byteLength ? 200 : 206,
        };
      }

      return this.json(404, {
        code: 'INVALID_REQUEST',
        message: '未找到请求的资源。',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '服务处理请求时发生未知错误。';
      return this.json(500, {
        code: 'STORAGE_WRITE_FAILED',
        message,
      });
    }
  }

  private html(status: number, body: string): TransferResponse {
    return {
      status,
      headers: {'content-type': 'text/html; charset=utf-8'},
      body,
    };
  }

  private json(status: number, body: object): TransferResponse {
    return {
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
      body,
    };
  }

  private renderUnauthorizedPage(message: string) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>访问受限</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f5efe3;
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        color: #182028;
      }
      .card {
        width: min(92vw, 540px);
        background: rgba(255, 249, 239, 0.95);
        border-radius: 26px;
        padding: 28px;
        border: 1px solid rgba(215, 198, 172, 0.95);
      }
      h1 { margin-top: 0; }
      p { color: #5d665c; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>需要重新获取链接</h1>
      <p>${message}</p>
      <p>请回到手机端，复制最新 URL 或重新扫描二维码后再访问。</p>
    </div>
  </body>
</html>`;
  }

  private setError(error: ServiceError) {
    this.state = {
      ...this.state,
      phase: 'error',
      error,
      accessUrl: undefined,
      qrValue: undefined,
    };
  }

  private touchConnection(request: TransferRequest) {
    const connectionId =
      request.headers['x-client-id'] ?? request.remoteAddress ?? 'anonymous';
    const connectionLabel =
      request.headers['user-agent'] ?? request.remoteAddress ?? 'Browser';
    const decision = this.connectionRegistry.touch(connectionId, connectionLabel);
    this.state = {
      ...this.state,
      activeConnections: this.connectionRegistry.snapshot(),
    };
    return decision;
  }

  private async syncStorageState() {
    const snapshot = await this.options.storage.getSnapshot();
    const activeConnections: ActiveConnection[] = this.connectionRegistry.snapshot();
    this.state = {
      ...this.state,
      activeConnections,
      activeProjectId: snapshot.activeProjectId,
      sharedFileCount: snapshot.sharedFileIds.length,
    };
  }

  private resolveUploadFiles(request: TransferRequest): NormalizedUploadFile[] {
    if (!(request.body instanceof Uint8Array)) {
      return [];
    }

    const name = request.query.get('name')?.trim();
    if (!name) {
      return [];
    }

    const relativePath = request.query.get('relativePath')?.trim() || name;
    return [
      {
        bytes: request.body,
        mimeType: normalizeMimeType(request.headers['content-type']),
        name,
        relativePath,
      },
    ];
  }
}

function normalizeMimeType(value?: string) {
  // Upload requests may include charset parameters; storage only needs the base MIME type.
  if (!value) {
    return undefined;
  }

  const [mimeType] = value.split(';');
  const normalized = mimeType?.trim();
  return normalized ? normalized : undefined;
}

function decodeSubmittedText(body: unknown) {
  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return decodeUtf8(body);
  }

  if (body && typeof body === 'object' && 'text' in body) {
    const candidate = (body as {text?: unknown}).text;
    return typeof candidate === 'string' ? candidate : undefined;
  }

  return undefined;
}

function decodeUtf8(bytes: Uint8Array) {
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

  let value = '';
  for (let index = 0; index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}
