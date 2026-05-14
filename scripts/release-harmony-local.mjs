import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  cleanupLocalHarmonyReleaseArtifacts,
  prepareLocalHarmonyReleaseEnv,
} from './harmony-local-release-config.mjs';
import { ensureHarmonyBundleFresh } from './ensure-harmony-bundle-fresh.mjs';

const repoRoot = process.cwd();
const isWindows = process.platform === 'win32';
const reactNativeCommand = isWindows
  ? path.join(repoRoot, 'node_modules', '.bin', 'react-native.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'react-native');
const trackedConfigPaths = [
  path.join(repoRoot, 'harmony', 'AppScope', 'app.json5'),
  path.join(repoRoot, 'harmony', 'build-profile.json5'),
  path.join(repoRoot, 'harmony', 'entry', 'build-profile.json5'),
  path.join(repoRoot, 'harmony', 'entry', 'src', 'main', 'module.json5'),
];
const harmonyBundlePath = path.join(
  repoRoot,
  'harmony',
  'entry',
  'src',
  'main',
  'resources',
  'rawfile',
  'bundle.harmony.js',
);

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

function hasFlag(name) {
  return process.argv.includes(name);
}

function shouldSkipBundle() {
  const envValue = String(process.env.HARMONY_SKIP_BUNDLE ?? '')
    .trim()
    .toLowerCase();

  return (
    hasFlag('--fast') ||
    hasFlag('--skip-bundle') ||
    envValue === '1' ||
    envValue === 'true' ||
    envValue === 'yes'
  );
}

function main() {
  if (hasFlag('--app')) {
    process.env.HARMONY_PACKAGE_TYPE = 'app';
  } else if (hasFlag('--hap')) {
    process.env.HARMONY_PACKAGE_TYPE = 'hap';
  }

  const snapshots = snapshotFiles(trackedConfigPaths);
  const prepared = prepareLocalHarmonyReleaseEnv();

  if (prepared.configPath) {
    console.log(
      `[harmony-release] local config=${path.relative(
        repoRoot,
        prepared.configPath,
      )}`,
    );
  } else {
    console.log('[harmony-release] local config=environment');
  }
  console.log(`[harmony-release] config mode=${prepared.mode}`);

  try {
    run(process.execPath, ['scripts/configure-harmony-project.mjs']);
    if (shouldSkipBundle()) {
      if (!fs.existsSync(harmonyBundlePath)) {
        throw new Error(
          `Cannot skip Harmony bundle because it does not exist: ${harmonyBundlePath}`,
        );
      }

      console.log('[harmony-release] JS bundle skipped');
    } else {
      run(
        reactNativeCommand,
        ['bundle-harmony', '--config', 'metro.config.js', '--dev', 'false'],
        {
          shell: isWindows,
        },
      );
    }

    ensureHarmonyBundleFresh();

    const buildArgs = ['scripts/build-harmony-release.mjs'];
    if (hasFlag('--fast') || hasFlag('--skip-ohpm-install')) {
      buildArgs.push('--skip-ohpm-install');
    }
    if (hasFlag('--clean-inactive-abi')) {
      buildArgs.push('--clean-inactive-abi');
    }
    run(process.execPath, buildArgs);
  } finally {
    restoreFiles(snapshots);
    cleanupLocalHarmonyReleaseArtifacts();
  }
}

main();
