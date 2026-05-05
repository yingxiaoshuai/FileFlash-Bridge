import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ensureDevEcoSdkHome } from './harmonySdk.mjs';

const repoRoot = process.cwd();
const harmonyDir = path.join(repoRoot, 'harmony');
const isWindows = process.platform === 'win32';

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

function ensurePathExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

function resolveDevEcoPaths() {
  const sdkHome = ensureDevEcoSdkHome();

  if (!sdkHome) {
    throw new Error(
      'DevEco SDK could not be resolved. Set DEVECO_SDK_HOME or install DevEco Studio into a standard location such as E:\\DevEco Studio\\sdk.',
    );
  }

  ensurePathExists(sdkHome, 'DevEco SDK directory');

  const sdkChildren = fs
    .readdirSync(sdkHome, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  if (sdkChildren.length === 0) {
    throw new Error(`No SDK platform directories found under ${sdkHome}`);
  }

  const toolsDir = path.resolve(sdkHome, '..', 'tools');
  const nodePath = fs.existsSync(path.join(toolsDir, 'node', 'bin', 'node'))
    ? path.join(toolsDir, 'node', 'bin', 'node')
    : path.join(toolsDir, 'node', 'node');
  const ohpmPath = isWindows
    ? path.join(toolsDir, 'ohpm', 'bin', 'ohpm.bat')
    : path.join(toolsDir, 'ohpm', 'bin', 'ohpm');
  const hvigorPath = path.join(toolsDir, 'hvigor', 'bin', 'hvigorw.js');

  ensurePathExists(toolsDir, 'DevEco tools directory');
  ensurePathExists(nodePath, 'DevEco Node runtime');
  ensurePathExists(ohpmPath, 'ohpm executable');
  ensurePathExists(hvigorPath, 'hvigor entry script');

  return {
    hvigorPath,
    nodePath,
    ohpmPath,
  };
}

function pickBuiltHap(outputDir) {
  const hapFiles = fs
    .readdirSync(outputDir)
    .filter(fileName => fileName.endsWith('.hap'))
    .sort((left, right) => left.localeCompare(right));

  if (hapFiles.length === 0) {
    throw new Error(`No HAP artifact was produced under ${outputDir}`);
  }

  return (
    hapFiles.find(fileName => fileName.includes('-signed.hap')) ?? hapFiles[0]
  );
}

function writeGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function main() {
  const { hvigorPath, nodePath, ohpmPath } = resolveDevEcoPaths();
  const buildMode = process.env.HARMONY_BUILD_MODE?.trim() || 'release';
  const moduleName = process.env.HARMONY_MODULE?.trim() || 'entry';
  const productName = process.env.HARMONY_PRODUCT?.trim() || 'default';
  const requiredDeviceType =
    process.env.HARMONY_REQUIRED_DEVICE_TYPE?.trim() || 'phone';

  run(ohpmPath, ['install', '--all'], {
    cwd: harmonyDir,
    shell: isWindows,
  });

  run(
    nodePath,
    [
      hvigorPath,
      '-p',
      `module=${moduleName}@default`,
      '-p',
      `product=${productName}`,
      '-p',
      `buildMode=${buildMode}`,
      '-p',
      `requiredDeviceType=${requiredDeviceType}`,
      'assembleHap',
    ],
    {
      cwd: harmonyDir,
      shell: isWindows,
    },
  );

  const outputDir = path.join(
    harmonyDir,
    moduleName,
    'build',
    'default',
    'outputs',
    'default',
  );

  ensurePathExists(outputDir, 'Harmony HAP output directory');

  const hapName = pickBuiltHap(outputDir);
  const hapPath = path.join(outputDir, hapName);

  console.log(`[harmony-build] artifact=${path.relative(repoRoot, hapPath)}`);
  writeGithubOutput('hap_path', hapPath);
}

main();
