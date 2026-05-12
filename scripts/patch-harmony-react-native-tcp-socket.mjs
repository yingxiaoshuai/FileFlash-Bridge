import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';

const repoRoot = process.cwd();
const packageTargets = [
  {
    label: 'oh_modules',
    root: path.join(
      repoRoot,
      'harmony',
      'oh_modules',
      '@react-native-oh-tpl',
      'react-native-tcp-socket',
      'src',
      'main',
      'ets',
    ),
  },
  {
    label: 'node_modules',
    root: path.join(
      repoRoot,
      'node_modules',
      '@react-native-oh-tpl',
      'react-native-tcp-socket',
      'harmony',
      'tcp_socket',
      'src',
      'main',
      'ets',
    ),
  },
];
const harTargets = [
  path.join(
    repoRoot,
    'node_modules',
    '@react-native-oh-tpl',
    'react-native-tcp-socket',
    'harmony',
    'tcp_socket.har',
  ),
];

function patchFile(filePath, patcher) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const realPath = fs.realpathSync(filePath);
  const source = fs.readFileSync(realPath, 'utf8');
  const nextSource = patcher(source);

  if (nextSource === source) {
    return false;
  }

  fs.writeFileSync(realPath, nextSource);
  return true;
}

function patchTcpSocketServer(source) {
  let nextSource = source.replace(
    /[ \t]*this\.receiverListener\?\.onListen\(this\.getId\(\), this\);[\r\n]*/g,
    '',
  );

  nextSource = nextSource
    .replace(/receiveBufferSize:\s*1000,/, 'receiveBufferSize: 1024 * 1024,')
    .replace(/sendBufferSize:\s*1000,/, 'sendBufferSize: 1024 * 1024,')
    .replace(/socketTimeout:\s*3000/, 'socketTimeout: 120000');

  nextSource = nextSource.replace(
    /Logger\.info\("listen callback error"\s*\+\s*err\.message\);\s*(?:this\.receiverListener\?\.onError\(this\.getId\(\), err\.message\);\s*)*return;/,
    `Logger.info("listen callback error" + err.message);
        this.receiverListener?.onError(this.getId(), err.message);
        return;`,
  );

  nextSource = nextSource.replace(
    /Logger\.info\("listen fail"\);\s*(?:this\.receiverListener\?\.onError\(this\.getId\(\), err\.message\);\s*)*return;/,
    `Logger.info("listen fail");
        this.receiverListener?.onError(this.getId(), err.message);
        return;`,
  );

  nextSource = nextSource.replace(
    /Logger\.info\("tlsSocketServer listen success"\);\s*/,
    `Logger.info("tlsSocketServer listen success");
      this.receiverListener?.onListen(this.getId(), this);
      `,
  );

  nextSource = nextSource.replace(
    /(\r\n|\n|\r)([ \t]*)this\.tcpSocketServer\.on\("connect", \(client: socket\.TCPSocketConnection\) => \{/,
    `${'$1'}${'$2'}this.receiverListener?.onListen(this.getId(), this);${'$1'}${'$2'}this.tcpSocketServer.on("connect", (client: socket.TCPSocketConnection) => {`,
  );

  nextSource = nextSource.replace(
    /  close\(\) \{\s*this\.tcpSocketServer\?\.off\("connect"\);\s*this\.tlsSocketServer\?\.off\("connect"\);\s*this\.receiverListener\?\.onClose\(this\.getId\(\), null\);\s*\}/,
    `  async close() {
    this.tcpSocketServer?.off("connect");
    this.tcpSocketServer?.off("error");
    this.tlsSocketServer?.off("connect");
    this.tlsSocketServer?.off("error");

    try {
      if (this.tcpSocketServer) {
        await this.tcpSocketServer.close();
        this.tcpSocketServer = undefined;
      }
      if (this.tlsSocketServer) {
        await this.tlsSocketServer.close();
        this.tlsSocketServer = undefined;
      }
      this.receiverListener?.onClose(this.getId(), null);
    } catch (err) {
      this.receiverListener?.onError(this.getId(), err?.message ?? JSON.stringify(err));
      this.receiverListener?.onClose(this.getId(), null);
    }
  }`,
  );

  return nextSource.replace(/\r(?!\n)/g, '\n');
}

function patchTcpSocketTurboModule(source) {
  let nextSource = source.replace(
    /\n    this\.tcpEvtListener\.onListen\(cId, tcpSocketServer\);/,
    '',
  );

  nextSource = nextSource.replace(
    /  close\(cid: number\): void \{\s*let socketServer: TcpSocketServer = this\.getTcpServer\(cid\);\s*socketServer\?\.close\(\);\s*let socketClient: TcpSocketClient = this\.getTcpClient\(cid\);\s*socketClient\?\.destroy\(\);\s*this\.socketMap\.delete\(cid\);\s*\}/,
    `  async close(cid: number): Promise<void> {
    let socketServer: TcpSocketServer = this.getTcpServer(cid);
    if (socketServer) {
      await socketServer.close();
    }
    let socketClient: TcpSocketClient = this.getTcpClient(cid);
    socketClient?.destroy();
    this.socketMap.delete(cid);
  }`,
  );

  return nextSource;
}

function runTar(args, cwd) {
  const result = spawnSync('tar', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(
      `tar ${args.join(' ')} failed: ${result.stderr || result.stdout}`,
    );
  }
}

function patchHar(harPath) {
  if (!fs.existsSync(harPath)) {
    return false;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffb-tcp-har-'));
  try {
    runTar(['-xf', harPath, '-C', tempDir], repoRoot);

    const packageRoot = path.join(tempDir, 'package', 'src', 'main', 'ets');
    const patchedServer = patchFile(
      path.join(packageRoot, 'TcpSocketServer.ts'),
      patchTcpSocketServer,
    );
    const patchedTurboModule = patchFile(
      path.join(packageRoot, 'TcpSocketTurboModule.ts'),
      patchTcpSocketTurboModule,
    );

    if (!patchedServer && !patchedTurboModule) {
      return false;
    }

    const tempHarPath = `${harPath}.tmp`;
    if (fs.existsSync(tempHarPath)) {
      fs.rmSync(tempHarPath, {force: true});
    }

    runTar(['-cf', tempHarPath, '-C', tempDir, 'package'], repoRoot);
    fs.renameSync(tempHarPath, harPath);
    return true;
  } finally {
    fs.rmSync(tempDir, {force: true, recursive: true});
  }
}

function main() {
  let patchedAny = false;

  for (const target of packageTargets) {
    const serverPath = path.join(target.root, 'TcpSocketServer.ts');
    const turboModulePath = path.join(target.root, 'TcpSocketTurboModule.ts');
    const patchedServer = patchFile(serverPath, patchTcpSocketServer);
    const patchedTurboModule = patchFile(
      turboModulePath,
      patchTcpSocketTurboModule,
    );

    if (patchedServer || patchedTurboModule) {
      patchedAny = true;
      console.log(`[harmony-patch] patched react-native-tcp-socket ${target.label}`);
    }
  }

  for (const harPath of harTargets) {
    if (patchHar(harPath)) {
      patchedAny = true;
      console.log(
        `[harmony-patch] patched react-native-tcp-socket ${path.relative(
          repoRoot,
          harPath,
        )}`,
      );
    }
  }

  if (!patchedAny) {
    console.log('[harmony-patch] react-native-tcp-socket already patched or not found');
  }
}

main();
