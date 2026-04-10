import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
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
  TransferRequest,
  TransferResponse,
} from '../modules/service/transferServiceController';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class NodeFileSystemAdapter implements FileSystemAdapter {
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

    return {
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
      },
    };
  }

  private async toTransferRequest(request: IncomingMessage): Promise<TransferRequest> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    const contentType = request.headers['content-type'] ?? '';
    const body =
      rawBody && contentType.includes('application/json')
        ? JSON.parse(rawBody)
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
