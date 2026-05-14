import {
  InboundStorageGateway,
  InboundUploadBody,
} from '../file-access/inboundStorageGateway';
import {
  AppLocale,
  createAppTranslator,
  DEFAULT_APP_LOCALE,
} from '../localization/i18n';
import {buildPortalDocument} from '../portal/portalDocument';
import {portalTheme} from '../portal/portalTheme';
import {
  ConnectionRegistry,
  authorizeRequest,
  buildAccessUrl,
  generateAccessKey,
} from '../security/accessControl';
import {
  NetworkInterfaceDescriptor,
  mergeNetworkSnapshotWithRuntimeAddress,
  resolveBrowserAccessAddress,
  resolveNetworkSnapshot,
} from './networkResolver';
import {
  ActiveConnection,
  ServiceConfig,
  ServiceError,
  ServiceState,
  createInitialServiceState,
} from './models';

export interface TransferRequest {
  body?: unknown;
  bodyFile?: {
    byteLength: number;
    path: string;
  };
  headers: Record<string, string | undefined>;
  method: string;
  path: string;
  query: URLSearchParams;
  remoteAddress?: string;
}

export interface TransferResponse {
  body?: object | string | Uint8Array;
  bodyFile?: {
    length: number;
    offset: number;
    path: string;
  };
  headers?: Record<string, string>;
  status: number;
}

export interface ServiceRuntimeHandle {
  /**
   * Runtime-reported origin. When available, it is preferred over the network
   * probe for building the access URL (e.g. Android hotspot where NetInfo may
   * not expose an IP address even though the native server is reachable).
   */
  origin?: string;
  port: number;
  refreshOrigin?(): Promise<string | undefined>;
  stop(): Promise<void>;
}

export interface ServiceRuntime {
  supportsFileResponses?: boolean;
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
  /**
   * 浏览器等外部请求写入会话存储后调用，用于宿主 App 刷新 UI（如项目文件列表）。
   * 每次变更时先调用工厂得到当前要执行的回调。
   */
  resolveInboundStorageChangeHandler?: () => (() => void | Promise<void>) | void;
  runtime?: ServiceRuntime;
  storage: InboundStorageGateway;
}

type NormalizedUploadFile = {
  byteLength?: number;
  bytes?: Uint8Array;
  mimeType?: string;
  name: string;
  relativePath?: string;
  sourcePath?: string;
};

export class TransferServiceController {
  private readonly connectionRegistry: ConnectionRegistry;

  private runtimeHandle?: ServiceRuntimeHandle;

  private state: ServiceState;

  private notifyInboundStorageChanged() {
    const factory = this.options.resolveInboundStorageChangeHandler;
    if (!factory) {
      return;
    }

    try {
      const handler = factory();
      if (typeof handler === 'function') {
        Promise.resolve(handler()).catch(() => {
          /* ignore */
        });
      }
    } catch {
      /* ignore listener failures */
    }
  }

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
    const securityMode = await this.options.storage
      .getSecurityModePreference()
      .catch(() => this.state.config.securityMode);
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        securityMode,
      },
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

  private async getTranslator(): Promise<{
    locale: AppLocale;
    t: ReturnType<typeof createAppTranslator>;
  }> {
    const locale =
      (await this.options.storage
        .getLocalePreference()
        .catch(() => DEFAULT_APP_LOCALE)) ?? DEFAULT_APP_LOCALE;

    return {
      locale,
      t: createAppTranslator(locale),
    };
  }

  private addressFromOrigin(origin?: string) {
    if (!origin) {
      return undefined;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        !hostname ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0'
      ) {
        return undefined;
      }
      return hostname;
    } catch {
      return undefined;
    }
  }

  private async resolveAddressFromRuntime(options?: {refresh?: boolean}) {
    let origin = this.runtimeHandle?.origin;

    if (options?.refresh && this.runtimeHandle?.refreshOrigin) {
      origin = (await this.runtimeHandle.refreshOrigin()) ?? origin;
    }

    return this.addressFromOrigin(origin);
  }

  async start() {
    await this.initialize();
    const {t} = await this.getTranslator();

    try {
      if (this.options.runtime) {
        this.runtimeHandle = await this.options.runtime.start({
          handler: request => this.handleRequest(request),
          port: this.state.config.port,
        });
      }

      const probed = resolveNetworkSnapshot(await this.options.networkProvider());
      const runtimeAddress = await this.resolveAddressFromRuntime();
      const address = runtimeAddress ?? probed.address;

      if (!address) {
        this.setError({
          code: 'NETWORK_UNAVAILABLE',
          message: t('api.networkUnavailable'),
          recoverable: true,
          suggestedAction: t('api.switchNetworkRetry'),
        });
        return this.getState();
      }

      const network = mergeNetworkSnapshotWithRuntimeAddress(
        probed,
        runtimeAddress,
      );
      const browserAddress = resolveBrowserAccessAddress(address);
      const port = this.runtimeHandle?.port ?? this.state.config.port;

      const accessUrl = buildAccessUrl(
        `http://${browserAddress}:${port}`,
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
        error instanceof Error ? error.message : t('api.startServiceFailed');
      this.setError({
        code: /EADDRINUSE/i.test(message) ? 'PORT_IN_USE' : 'SERVICE_STOPPED',
        message,
        recoverable: true,
        suggestedAction: t('api.changePortOrStopConflict'),
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

  async refreshAddress(options?: {rotateAccessKey?: boolean}) {
    const {t} = await this.getTranslator();
    if (options?.rotateAccessKey) {
      this.state = {
        ...this.state,
        config: {
          ...this.state.config,
          accessKey: generateAccessKey(),
        },
      };
    }

    const probed = resolveNetworkSnapshot(await this.options.networkProvider());
    const runtimeAddress = await this.resolveAddressFromRuntime({
      refresh: true,
    });
    const address = runtimeAddress ?? probed.address;

    if (!address) {
      this.setError({
        code: 'NETWORK_UNAVAILABLE',
        message: t('api.addressUnavailable'),
        recoverable: true,
        suggestedAction: t('api.switchNetworkOrRefresh'),
      });
      return this.getState();
    }

    const network = mergeNetworkSnapshotWithRuntimeAddress(
      probed,
      runtimeAddress,
    );
    const browserAddress = resolveBrowserAccessAddress(address);
    const port = this.runtimeHandle?.port ?? this.state.config.port;

    const accessUrl = buildAccessUrl(
      `http://${browserAddress}:${port}`,
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
        message: t('api.networkRefreshed'),
        recoverable: true,
        suggestedAction: t('api.useNewAddress'),
      },
    };
    return this.getState();
  }

  async setSecurityMode(mode: ServiceConfig['securityMode']) {
    await this.options.storage.setSecurityModePreference(mode);
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
    return this.refreshAddress({rotateAccessKey: true});
  }

  async handleRequest(request: TransferRequest): Promise<TransferResponse> {
    const {locale, t} = await this.getTranslator();

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
        return this.html(
          401,
          this.renderUnauthorizedPage(
            authorization.reason ?? t('api.unauthorized'),
            locale,
          ),
        );
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
            binaryBridgeChunkSize: this.state.config.binaryBridgeChunkSize,
            chunkSize: this.state.config.chunkSize,
            deviceName: this.state.config.deviceName,
            locale,
            securityMode: this.state.config.securityMode,
          }),
        );
      }

      if (request.path === '/api/status' && request.method === 'GET') {
        await this.syncStorageState();
        return this.json(200, {
          activeConnections: this.state.activeConnections.length,
          activeProjectId: this.state.activeProjectId,
          binaryBridgeChunkSize: this.state.config.binaryBridgeChunkSize,
          chunkSize: this.state.config.chunkSize,
          notice:
            this.state.config.securityMode === 'simple'
              ? t('api.status.simpleNotice')
              : t('api.status.secureNotice'),
          phase: this.state.phase,
          securityMode: this.state.config.securityMode,
          sharedFileCount: this.state.sharedFileCount,
        });
      }

      if (request.path === '/api/upload/begin' && request.method === 'POST') {
        const payload = decodeJsonObject(request.body);
        if (!payload) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.invalidJsonObject'),
          });
        }

        const name = readTrimmedString(payload.name);
        const relativePath = readTrimmedString(payload.relativePath) ?? name;
        const totalBytes = readFiniteNumber(payload.totalBytes);
        const mimeType = readOptionalString(payload.mimeType);

        if (!name || totalBytes == null || totalBytes <= 0) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.invalidUploadBeginFields'),
          });
        }

        try {
          const {uploadId} = await this.options.storage.beginInboundUpload({
            mimeType,
            name,
            relativePath: relativePath ?? name,
            totalBytes,
          });
          return this.json(200, {uploadId});
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('api.cannotStartChunkedUpload');
          return this.json(400, {code: 'INVALID_REQUEST', message});
        }
      }

      if (request.path === '/api/upload/part' && request.method === 'POST') {
        const uploadId = request.query.get('uploadId')?.trim();
        if (!uploadId) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.missingUploadId'),
          });
        }

        const offsetParam = request.query.get('offset')?.trim();
        const offset =
          offsetParam && offsetParam.length > 0 ? Number(offsetParam) : undefined;
        if (
          offsetParam &&
          (!Number.isFinite(offset) || (offset ?? 0) < 0)
        ) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.invalidUploadBeginFields'),
          });
        }

        try {
          const body: InboundUploadBody =
            request.bodyFile != null
              ? {
                  byteLength: request.bodyFile.byteLength,
                  sourcePath: request.bodyFile.path,
                }
              : request.body instanceof Uint8Array
                ? request.body
                : (() => {
                    throw new Error('Invalid upload chunk data.');
                  })();
          await this.options.storage.appendInboundUpload(
            uploadId,
            body,
            {
              offset,
            },
          );
          return this.json(200, {ok: true});
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('api.chunkWriteFailed');
          return this.json(400, {code: 'INVALID_REQUEST', message});
        }
      }

      if (request.path === '/api/upload/finish' && request.method === 'POST') {
        const payload = decodeJsonObject(request.body);
        const uploadId =
          (typeof payload?.uploadId === 'string' && payload.uploadId.trim()) ||
          request.query.get('uploadId')?.trim();

        if (!uploadId) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.missingUploadId'),
          });
        }

        try {
          const savedFile = await this.options.storage.finalizeInboundUpload(
            uploadId,
          );
          await this.syncStorageState();
          this.notifyInboundStorageChanged();
          return this.json(200, {
            files: [savedFile],
            message: t('api.fileSavedToSession'),
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t('api.finishChunkedUploadFailed');
          return this.json(400, {code: 'INVALID_REQUEST', message});
        }
      }

      if (request.path === '/api/upload/abort' && request.method === 'POST') {
        const payload = decodeJsonObject(request.body);
        const uploadId =
          (typeof payload?.uploadId === 'string' && payload.uploadId.trim()) ||
          request.query.get('uploadId')?.trim();

        if (uploadId) {
          await this.options.storage.abortInboundUpload(uploadId);
        }

        return this.json(200, {ok: true});
      }

      if (request.path === '/api/upload' && request.method === 'POST') {
        const files = this.resolveUploadFiles(request);
        if (!files.length) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.noFilesUploaded'),
          });
        }

        const results = [];
        for (const file of files) {
          const savedFile =
            file.sourcePath && file.byteLength != null
              ? await this.options.storage.saveInboundFile({
                  byteLength: file.byteLength,
                  mimeType: file.mimeType,
                  name: file.name,
                  relativePath: file.relativePath,
                  sourcePath: file.sourcePath,
                })
              : await this.options.storage.saveInboundFile({
                  bytes: file.bytes ?? new Uint8Array(0),
                  mimeType: file.mimeType,
                  name: file.name,
                  relativePath: file.relativePath,
                });
          results.push(savedFile);
        }

        await this.syncStorageState();
        this.notifyInboundStorageChanged();
        return this.json(200, {
          files: results,
          message: t('api.fileSavedToSession'),
        });
      }

      if (request.path === '/api/text' && request.method === 'POST') {
        const text = decodeSubmittedText(request.body)?.trim();

        if (!text) {
          return this.json(400, {
            code: 'INVALID_REQUEST',
            message: t('api.emptySubmittedText'),
          });
        }

        if (text.length > this.state.config.maxTextLength) {
          return this.json(413, {
            code: 'TEXT_TOO_LARGE',
            message: t('api.textTooLarge'),
          });
        }

        const message = await this.options.storage.appendTextMessage(text);
        const snapshot = await this.options.storage.getSnapshot();
        const activeProject = snapshot.projects.find(
          project => project.id === snapshot.activeProjectId,
        );
        await this.syncStorageState();
        this.notifyInboundStorageChanged();
        return this.json(200, {
          activeProjectId: snapshot.activeProjectId,
          activeProjectTitle: activeProject?.title ?? t('project.currentRound'),
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
        const directDownload = request.query.get('direct') === '1';
        const offset = directDownload
          ? 0
          : Number(request.query.get('offset') ?? '0');
        const requestedLength = Number(
          request.query.get('length') ?? `${this.state.config.chunkSize}`,
        );
        const length = directDownload
          ? Number.MAX_SAFE_INTEGER
          : Math.max(
              0,
              Math.min(
                Number.isFinite(requestedLength)
                  ? requestedLength
                  : this.state.config.chunkSize,
                this.state.config.chunkSize,
                this.state.config.binaryBridgeChunkSize,
              ),
            );
        const start = Number.isFinite(offset) ? Math.max(0, offset) : 0;
        const chunk = await this.options.storage.prepareFileChunk(fileId, {
          length,
          offset: start,
          preferSourceFile: this.options.runtime?.supportsFileResponses,
        });
        const status =
          start === 0 && chunk.contentLength === chunk.totalSize ? 200 : 206;

        const headers = {
          'content-disposition': `attachment; filename="${encodeURIComponent(
            chunk.file.displayName,
          )}"`,
          'content-length': String(chunk.contentLength),
          'content-type': chunk.file.mimeType ?? 'application/octet-stream',
          'x-file-size': String(chunk.totalSize),
        };

        if (chunk.sourceFile) {
          return {
            bodyFile: chunk.sourceFile,
            headers,
            status,
          };
        }

        return {
          body: chunk.bytes,
          headers,
          status,
        };
      }

      return this.json(404, {
        code: 'INVALID_REQUEST',
        message: t('api.resourceNotFound'),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('api.storageUnknown');
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

  private renderUnauthorizedPage(message: string, locale: AppLocale) {
    const t = createAppTranslator(locale);
    return `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t('portal.unauthorizedTitle')}</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at top right, ${portalTheme.glowPrimary}, transparent 30%),
            radial-gradient(circle at left bottom, ${portalTheme.glowTertiary}, transparent 38%),
            ${portalTheme.backdrop};
          font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
          color: ${portalTheme.ink};
        }
        .card {
          width: min(92vw, 540px);
          backdrop-filter: blur(16px);
          background: ${portalTheme.panelStrong};
          border-radius: 30px;
          padding: 30px;
          border: 1px solid ${portalTheme.lineSoft};
          box-shadow: 0 24px 64px ${portalTheme.shadow};
        }
        h1 { margin-top: 0; letter-spacing: -0.04em; }
        p { color: ${portalTheme.muted}; line-height: 1.6; }
      </style>
  </head>
  <body>
    <div class="card">
      <h1>${t('portal.unauthorizedTitle')}</h1>
      <p>${message}</p>
      <p>${t('portal.unauthorizedInstruction')}</p>
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
    const name = request.query.get('name')?.trim();
    if (!name) {
      return [];
    }

    const relativePath = request.query.get('relativePath')?.trim() || name;

    if (request.bodyFile) {
      return [
        {
          byteLength: request.bodyFile.byteLength,
          mimeType: normalizeMimeType(request.headers['content-type']),
          name,
          relativePath,
          sourcePath: request.bodyFile.path,
        },
      ];
    }

    if (request.body instanceof Uint8Array) {
      return [
        {
          bytes: request.body,
          mimeType: normalizeMimeType(request.headers['content-type']),
          name,
          relativePath,
        },
      ];
    }

    if (typeof request.body === 'string') {
      return [
        {
          bytes: new TextEncoder().encode(request.body),
          mimeType: normalizeMimeType(request.headers['content-type']),
          name,
          relativePath,
        },
      ];
    }

    if (!(request.body instanceof Uint8Array)) {
      return [];
    }

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
  return decodeURIComponent(escape(value));
}

function decodeJsonObject(body: unknown): Record<string, unknown> | null {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function readTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
