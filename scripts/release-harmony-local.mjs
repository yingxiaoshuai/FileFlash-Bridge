import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  cleanupLocalHarmonyReleaseArtifacts,
  prepareLocalHarmonyReleaseEnv,
} from './harmony-local-release-config.mjs';

const repoRoot = process.cwd();
const isWindows = process.platform === 'win32';
const reactNativeCommand = isWindows
  ? path.join(repoRoot, 'node_modules', '.bin', 'react-native.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'react-native');
const trackedConfigPaths = [
  path.join(repoRoot, 'harmony', 'AppScope', 'app.json5'),
  path.join(repoRoot, 'harmony', 'build-profile.json5'),
  path.join(repoRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: options.shell ?? false,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? 1}: ${command}`,
    );
  }
}

function snapshotFiles(filePaths) {
  return filePaths.map(filePath => ({
    content: fs.readFileSync(filePath, 'utf8'),
    filePath,
  }));
}

function restoreFiles(snapshots) {
  for (const snapshot of snapshots) {
    fs.writeFileSync(snapshot.filePath, snapshot.content);
  }
}

function main() {
  const snapshots = snapshotFiles(trackedConfigPaths);
  const prepared = prepareLocalHarmonyReleaseEnv();

  if (prepared.configPath) {
    console.log(
      `[harmony-release] local config=${path.relative(repoRoot, prepared.configPath)}`,
    );
  } else {
    console.log('[harmony-release] local config=environment');
  }
  console.log(`[harmony-release] config mode=${prepared.mode}`);

  try {
    run(process.execPath, ['scripts/configure-harmony-project.mjs']);
    run(reactNativeCommand, ['bundle-harmony', '--config', 'metro.config.js'], {
      shell: isWindows,
    });
    run(process.execPath, ['scripts/build-harmony-release.mjs']);
  } finally {
    restoreFiles(snapshots);
    cleanupLocalHarmonyReleaseArtifacts();
  }
}

main();
