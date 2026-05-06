import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureDevEcoSdkHome } from './harmonySdk.mjs';

const repoRoot = process.cwd();
const harmonyDir = path.join(repoRoot, 'harmony');
const harmonyEntryBuildProfilePath = path.join(
  harmonyDir,
  'entry',
  'build-profile.json5',
);
const isWindows = process.platform === 'win32';
const staleNinjaFileNames = new Set([
  '.ninja_deps',
  '.ninja_lock',
  '.ninja_log',
  '.ninja_log.restat',
  'output.log',
]);

function quotePowerShellArg(value) {
  const stringValue = String(value ?? '');
  return `'${stringValue.replace(/'/g, "''")}'`;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function run(command, args, options = {}) {
  const usePowerShellWrapper =
    isWindows && /\.(bat|cmd)$/i.test(command) && options.shell !== true;
  const spawnCommand = usePowerShellWrapper ? 'powershell.exe' : command;
  const spawnArgs = usePowerShellWrapper
    ? [
        '-NoLogo',
        '-NoProfile',
        '-Command',
        `& ${quotePowerShellArg(command)} ${args
          .map(quotePowerShellArg)
          .join(' ')}`.trim(),
      ]
    : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: options.shell ?? false,
    stdio: options.stdio ?? 'inherit',
  });

  if (result.status !== 0) {
    const stdout = result.stdout
      ? `\nStdout:\n${String(result.stdout)}`
      : '';
    const stderr = result.stderr
      ? `\nStderr:\n${String(result.stderr)}`
      : '';
    throw new Error(
      `Command failed with exit code ${result.status ?? 1}: ${command}${stdout}${stderr}`,
    );
  }
}

function resolveNativeBuildParallelism() {
  const logicalCores =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length;
  const defaultBuildJobs = isWindows
    ? Math.max(2, Math.min(4, Math.floor(logicalCores * 0.25) || 2))
    : Math.max(2, Math.min(6, Math.floor(logicalCores * 0.5) || 2));
  const buildJobs =
    parsePositiveInt(process.env.CMAKE_BUILD_PARALLEL_LEVEL) ??
    parsePositiveInt(process.env.HARMONY_BUILD_JOBS) ??
    defaultBuildJobs;
  const linkJobs =
    parsePositiveInt(process.env.HARMONY_LINK_JOBS) ??
    (isWindows ? 1 : Math.max(1, Math.min(2, Math.floor(buildJobs / 3))));

  return {
    buildJobs,
    linkJobs,
  };
}

function resolveAbiFilters() {
  const configuredValue = String(process.env.HARMONY_ABI_FILTERS ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (configuredValue.length > 0) {
    return configuredValue;
  }

  return ['arm64-v8a'];
}

function syncHarmonyEntryBuildProfile(buildJobs, linkJobs, abiFilters) {
  if (!fs.existsSync(harmonyEntryBuildProfilePath)) {
    return;
  }

  const nextArguments =
    '-DENABLE_COMPILE_OPTIMIZATIONS=OFF ' +
    `-DCMAKE_JOB_POOLS=compile_pool=${buildJobs};link_pool=${linkJobs} ` +
    '-DCMAKE_JOB_POOL_COMPILE=compile_pool ' +
    '-DCMAKE_JOB_POOL_LINK=link_pool';
  const abiFiltersLiteral = abiFilters.map(abi => `"${abi}"`).join(', ');
  const currentContent = fs.readFileSync(harmonyEntryBuildProfilePath, 'utf8');
  let nextContent = currentContent.replace(
    /("arguments":\s*")[^"]*(")/,
    `$1${nextArguments}$2`,
  );

  if (/"abiFilters":\s*\[[^\]]*\]/.test(nextContent)) {
    nextContent = nextContent.replace(
      /("abiFilters":\s*)\[[^\]]*\]/,
      `$1[${abiFiltersLiteral}]`,
    );
  } else {
    nextContent = nextContent.replace(
      /("arguments":\s*"[^"]*",?)/,
      `$1\n      "abiFilters": [${abiFiltersLiteral}],`,
    );
  }

  if (nextContent !== currentContent) {
    fs.writeFileSync(harmonyEntryBuildProfilePath, nextContent);
  }
}

function walkFilesRecursively(rootDir, visitor) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFilesRecursively(absolutePath, visitor);
      continue;
    }

    visitor(absolutePath, entry);
  }
}

function cleanupStaleNinjaFiles(moduleName) {
  const cxxRoot = path.join(harmonyDir, moduleName, '.cxx');
  walkFilesRecursively(cxxRoot, filePath => {
    if (!staleNinjaFileNames.has(path.basename(filePath))) {
      return;
    }

    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // If a file is still locked, the retry after process cleanup will surface it.
    }
  });
}

function stopLingeringHarmonyBuildProcesses() {
  if (!isWindows) {
    return;
  }

  const repoPathForMatch = repoRoot.replace(/'/g, "''");
  const script = `
$repoPath = '${repoPathForMatch}'
$targets = Get-CimInstance Win32_Process | Where-Object {
  (
    ($_.Name -ieq 'ninja.exe' -or $_.Name -ieq 'cmake.exe')
    -and $_.CommandLine
    -and $_.CommandLine -like "*$repoPath*"
  ) -or (
    $_.Name -ieq 'node.exe'
    -and $_.CommandLine
    -and (
      $_.CommandLine -like "*hvigorw.js*"
      -or $_.CommandLine -like "*daemon-process-boot-script.js*"
    )
  )
}

foreach ($target in $targets) {
  Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
}
`.trim();

  spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-Command', script],
    {
      cwd: repoRoot,
      stdio: 'pipe',
    },
  );
}

function ensurePathExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

function pickExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (candidatePath && fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
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

  const toolsDir = pickExistingPath([
    path.resolve(sdkHome, '..', 'tools'),
    path.resolve(sdkHome, '..', '..', 'tools'),
  ]);
  const nodePath = pickExistingPath([
    toolsDir ? path.join(toolsDir, 'node', 'bin', 'node') : null,
    toolsDir ? path.join(toolsDir, 'node', 'bin', 'node.exe') : null,
    toolsDir ? path.join(toolsDir, 'node', 'node') : null,
    toolsDir ? path.join(toolsDir, 'node', 'node.exe') : null,
  ]);
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
  const { buildJobs, linkJobs } = resolveNativeBuildParallelism();
  const abiFilters = resolveAbiFilters();

  stopLingeringHarmonyBuildProcesses();
  cleanupStaleNinjaFiles(moduleName);
  syncHarmonyEntryBuildProfile(buildJobs, linkJobs, abiFilters);

  console.log(
    `[harmony-build] native parallelism: compile=${buildJobs}, link=${linkJobs}`,
  );
  console.log(`[harmony-build] native abiFilters: ${abiFilters.join(', ')}`);

  run(ohpmPath, ['install', '--all'], {
    cwd: harmonyDir,
    shell: false,
    stdio: 'pipe',
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
      env: {
        CMAKE_BUILD_PARALLEL_LEVEL: String(buildJobs),
        HARMONY_BUILD_JOBS: String(buildJobs),
        HARMONY_LINK_JOBS: String(linkJobs),
        HARMONY_ABI_FILTERS: abiFilters.join(','),
      },
      shell: false,
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
