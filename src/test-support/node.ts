import {Buffer} from 'node:buffer';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {
  appendFile as fsAppendFile,
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
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
  TransferRequest,
  TransferResponse,
} from '../modules/service/transferServiceController';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

function shouldPreserveRawBody(path: string) {
  return path === '/api/upload' || path === '/api/upload/part';
}

export class NodeFileSystemAdapter implements FileSystemAdapter {
  async copyFile(sourcePath: string, destinationPath: string) {
    await mkdir(dirname(destinationPath), {recursive: true});
    await copyFile(sourcePath, destinationPath);
  }

  async moveFile(sourcePath: string, destinationPath: string) {
    await mkdir(dirname(destinationPath), {recursive: true});
    try {
      await rename(sourcePath, destinationPath);
    } catch {
      await copyFile(sourcePath, destinationPath);
      await rm(sourcePath, {force: true, recursive: true});
    }
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

  async getFileSize(path: string) {
    return (await stat(path)).size;
  }

  async listFiles(path: string) {
    return readdir(path);
  }

  async readFileChunk(path: string, offset: number, length: number) {
    const fileHandle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const {bytesRead} = await fileHandle.read(buffer, 0, length, offset);
      return new Uint8Array(buffer.subarray(0, bytesRead));
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
    await mkdir(dirname(path), {recursive: true});
    await fsAppendFile(path, Buffer.from(content));
  }

  async appendFileFromPath(path: string, sourcePath: string) {
    await mkdir(dirname(path), {recursive: true});
    await fsAppendFile(path, await readFile(sourcePath));
  }

  async writeFileFromPathAtOffset(
    destinationPath: string,
    sourcePath: string,
    offset: number,
    length: number,
  ) {
    await mkdir(dirname(destinationPath), {recursive: true});
    const sourceHandle = await open(sourcePath, 'r');
    let destinationHandle;
    try {
      try {
        destinationHandle = await open(destinationPath, 'r+');
      } catch {
        destinationHandle = await open(destinationPath, 'w+');
      }

      const requestedLength = Math.max(0, Math.trunc(length));
      const buffer = Buffer.alloc(
        Math.min(256 * 1024, Math.max(1, requestedLength)),
      );
      let remaining = requestedLength;
      let readOffset = 0;
      let writeOffset = Math.max(0, Math.trunc(offset));

      while (remaining > 0) {
        const readLength = Math.min(buffer.byteLength, remaining);
        const {bytesRead} = await sourceHandle.read(
          buffer,
          0,
          readLength,
          readOffset,
        );
        if (bytesRead <= 0) {
          throw new Error(
            `Source file ended before ${requestedLength} bytes could be written.`,
          );
        }

        await destinationHandle.write(buffer, 0, bytesRead, writeOffset);
        remaining -= bytesRead;
        readOffset += bytesRead;
        writeOffset += bytesRead;
      }
    } finally {
      await sourceHandle.close();
      await destinationHandle?.close();
    }
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
  supportsFileResponses?: boolean;

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

    const handle = {
      origin: `http://127.0.0.1:${address.port}`,
      port: address.port,
      refreshOrigin: async () => handle.origin,
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

    return handle;
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
    const rawContentType = request.headers['content-type'];
    const contentType = Array.isArray(rawContentType)
      ? rawContentType.join(', ')
      : rawContentType ?? '';
    let body: unknown;

    if (shouldPreserveRawBody(url.pathname)) {
      body = new Uint8Array(rawBuffer);
    } else if (rawBody && contentType.includes('application/json')) {
      body = JSON.parse(rawBody);
    } else if (rawBody && contentType.startsWith('text/')) {
      body = rawBody;
    } else if (rawBuffer.length > 0) {
      body = new Uint8Array(rawBuffer);
    }

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

    if (transferResponse.bodyFile) {
      void readFile(transferResponse.bodyFile.path)
        .then(fileBytes => {
          const start = Math.max(0, transferResponse.bodyFile!.offset);
          const end = Math.min(
            fileBytes.byteLength,
            start + transferResponse.bodyFile!.length,
          );
          response.end(fileBytes.subarray(start, end));
        })
        .catch(error => {
          response.statusCode = 500;
          response.end(
            error instanceof Error ? error.message : 'Unable to read file',
          );
        });
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
