import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {
  appendFile as fsAppendFile,
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {dirname} from 'node:path';
import {promisify} from 'node:util';
import {gzip, gunzip} from 'node:zlib';

import {
  CompressionAdapter,
  FileSystemAdapter,
} from '../modules/file-access/inboundStorageGateway';
import {
  ServiceRuntime,
  ServiceRuntimeHandle,
  isTransferBase64Body,
  TransferRequest,
  TransferResponse,
} from '../modules/service/transferServiceController';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class NodeFileSystemAdapter implements FileSystemAdapter {
  async copyFile(sourcePath: string, destinationPath: string) {
    await mkdir(dirname(destinationPath), {recursive: true});
    await copyFile(sourcePath, destinationPath);
  }

  async deletePath(path: string) {
    await rm(path, {force: true, recursive: true});
  }

  async ensureDir(path: string) {
    await mkdir(path, {recursive: true});
  }

  async exists(path: string) {
    try {
      await readFile(path);
      return true;
    } catch {
      try {
        await readdir(path);
        return true;
      } catch {
        return false;
      }
    }
  }

  async listFiles(path: string) {
    return readdir(path);
  }

  async readFileChunkBase64(path: string, offset: number, length: number) {
    const fileHandle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const {bytesRead} = await fileHandle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead).toString('base64');
    } finally {
      await fileHandle.close();
    }
  }

  async readFile(path: string) {
    return new Uint8Array(await readFile(path));
  }

  async readText(path: string) {
    return readFile(path, 'utf8');
  }

  async writeFile(path: string, content: Uint8Array) {
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, Buffer.from(content));
  }

  async appendFile(path: string, content: Uint8Array) {
    await fsAppendFile(path, Buffer.from(content));
  }

  async appendFileBase64(path: string, contentBase64: string) {
    await fsAppendFile(path, Buffer.from(contentBase64, 'base64'));
  }

  async writeFileBase64(path: string, contentBase64: string) {
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, Buffer.from(contentBase64, 'base64'));
  }

  async writeText(path: string, content: string) {
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, content, 'utf8');
  }
}

export const nodeGzipCompression: CompressionAdapter = {
  async compress(content) {
    return new Uint8Array(await gzipAsync(Buffer.from(content)));
  },
  async decompress(content) {
    return new Uint8Array(await gunzipAsync(Buffer.from(content)));
  },
};

export class NodeHttpRuntime implements ServiceRuntime {
  private server?: ReturnType<typeof createServer>;

  async start(options: {
    handler: (request: TransferRequest) => Promise<TransferResponse>;
    port: number;
  }): Promise<ServiceRuntimeHandle> {
    const server = createServer(async (request, response) => {
      try {
        const transferRequest = await this.toTransferRequest(request);
        const transferResponse = await options.handler(transferRequest);
        this.writeResponse(response, transferResponse);
      } catch (error) {
        response.statusCode = 500;
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            message: error instanceof Error ? error.message : 'Unexpected error',
          }),
        );
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to determine test server port.');
    }

    this.server = server;

    return {
      origin: `http://127.0.0.1:${address.port}`,
      port: address.port,
      stop: async () => {
        await new Promise<void>((resolve, reject) => {
          server.close(error => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
        this.server = undefined;
      },
    };
  }

  async isRunning() {
    return this.server?.listening ?? false;
  }

  private async toTransferRequest(request: IncomingMessage): Promise<TransferRequest> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBuffer = Buffer.concat(chunks);
    const rawBody = rawBuffer.toString('utf8');
    const contentType = request.headers['content-type'] ?? '';
    const body =
      rawBody && contentType.includes('application/json')
        ? JSON.parse(rawBody)
        : rawBody && contentType.startsWith('text/')
          ? rawBody
        : rawBuffer.length > 0
          ? new Uint8Array(rawBuffer)
          : undefined;

    return {
      body,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(', ') : value,
        ]),
      ),
      method: request.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      remoteAddress: request.socket.remoteAddress ?? undefined,
    };
  }

  private writeResponse(response: ServerResponse, transferResponse: TransferResponse) {
    response.statusCode = transferResponse.status;

    for (const [key, value] of Object.entries(transferResponse.headers ?? {})) {
      response.setHeader(key, value);
    }

    if (isTransferBase64Body(transferResponse.body)) {
      response.end(Buffer.from(transferResponse.body.base64, 'base64'));
      return;
    }

    if (transferResponse.body instanceof Uint8Array) {
      response.end(Buffer.from(transferResponse.body));
      return;
    }

    if (typeof transferResponse.body === 'string' || !transferResponse.body) {
      response.end(transferResponse.body ?? '');
      return;
    }

    response.end(JSON.stringify(transferResponse.body));
  }
}
