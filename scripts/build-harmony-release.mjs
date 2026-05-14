import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureHarmonyBundleFresh } from './ensure-harmony-bundle-fresh.mjs';
import { ensureDevEcoSdkHome } from './harmonySdk.mjs';

const repoRoot = process.cwd();
const harmonyDir = path.join(repoRoot, 'harmony');
const harmonyEntryBuildProfilePath = path.join(
  harmonyDir,
  'entry',
  'build-profile.json5',
);
const harmonyBuildLogPath = path.join(
  harmonyDir,
  '.hvigor',
  'outputs',
  'build-logs',
  'build.log',
);
const isWindows = process.platform === 'win32';
const normalNinjaFileNames = new Set(['.ninja_lock']);
const recoveryNinjaFileNames = new Set([
  '.ninja_deps',
  '.ninja_lock',
  '.ninja_log',
  '.ninja_log.restat',
  'output.log',
]);
const nativeAbiNames = new Set(['arm64-v8a', 'x86_64']);

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
    const stdout = result.stdout ? `\nStdout:\n${String(result.stdout)}` : '';
    const stderr = result.stderr ? `\nStderr:\n${String(result.stderr)}` : '';
    throw new Error(
      `Command failed with exit code ${
        result.status ?? 1
      }: ${command}${stdout}${stderr}`,
    );
  }
}

function runHarmonyDependencyPatches() {
  for (const patchScript of [
    'scripts/patch-harmony-react-native-fs.mjs',
    'scripts/patch-harmony-react-native-tcp-socket.mjs',
  ]) {
    run(process.execPath, [patchScript]);
  }
}

function resolveNativeBuildParallelism() {
  const logicalCores =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length;
  const defaultBuildJobs = isWindows
    ? 2
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

function resolveFallbackBuildJobs(buildJobs, linkJobs) {
  const nextBuildJobs = buildJobs > 1 ? 1 : buildJobs;
  const nextLinkJobs = Math.max(1, Math.min(linkJobs, 1));

  if (nextBuildJobs === buildJobs && nextLinkJobs === linkJobs) {
    return null;
  }

  return {
    buildJobs: nextBuildJobs,
    linkJobs: nextLinkJobs,
  };
}

function resolveJavaToolOptions() {
  const existing = String(process.env.JAVA_TOOL_OPTIONS ?? '').trim();
  if (existing) {
    return existing;
  }

  return '-Xmx512m -XX:ReservedCodeCacheSize=64m';
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
    `-DHARMONY_NATIVE_COMPILE_JOBS=${buildJobs} ` +
    `-DHARMONY_NATIVE_LINK_JOBS=${linkJobs} ` +
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

function cleanupNinjaFiles(moduleName, mode = 'normal') {
  const cxxRoot = path.join(harmonyDir, moduleName, '.cxx');
  const fileNames =
    mode === 'recovery' ? recoveryNinjaFileNames : normalNinjaFileNames;

  walkFilesRecursively(cxxRoot, filePath => {
    if (!fileNames.has(path.basename(filePath))) {
      return;
    }

    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // If a file is still locked, the retry after process cleanup will surface it.
    }
  });
}

function shouldSkipOhpmInstall() {
  const envValue = String(process.env.HARMONY_SKIP_OHPM_INSTALL ?? '')
    .trim()
    .toLowerCase();

  return (
    process.argv.includes('--skip-ohpm-install') ||
    envValue === '1' ||
    envValue === 'true' ||
    envValue === 'yes'
  );
}

function shouldCleanupInactiveAbiArtifacts() {
  const envValue = String(process.env.HARMONY_CLEAN_INACTIVE_ABI ?? '')
    .trim()
    .toLowerCase();

  return (
    process.argv.includes('--clean-inactive-abi') ||
    envValue === '1' ||
    envValue === 'true' ||
    envValue === 'yes'
  );
}

function snapshotExistingFiles(filePaths) {
  return filePaths
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => ({
      content: fs.readFileSync(filePath, 'utf8'),
      filePath,
    }));
}

function restoreFileSnapshots(snapshots) {
  for (const snapshot of snapshots) {
    fs.writeFileSync(snapshot.filePath, snapshot.content);
  }
}

function cleanupInactiveAbiDirs(rootDir, activeAbis) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(rootDir, entry.name);
    if (nativeAbiNames.has(entry.name)) {
      if (!activeAbis.has(entry.name)) {
        try {
          fs.rmSync(entryPath, {
            force: true,
            recursive: true,
          });
        } catch {
          // A locked stale ABI directory will surface during the following build.
        }
      }
      continue;
    }

    cleanupInactiveAbiDirs(entryPath, activeAbis);
  }
}

function cleanupInactiveAbiArtifacts(moduleName, abiFilters) {
  const activeAbis = new Set(abiFilters);
  const moduleBuildDir = path.join(harmonyDir, moduleName, 'build', 'default');
  const nativeOutputRoots = [
    path.join(harmonyDir, moduleName, '.cxx'),
    path.join(moduleBuildDir, 'intermediates', 'cmake', 'default', 'obj'),
    path.join(moduleBuildDir, 'intermediates', 'libs', 'default'),
    path.join(
      moduleBuildDir,
      'intermediates',
      'stripped_native_libs',
      'default',
    ),
  ];

  for (const nativeOutputRoot of nativeOutputRoots) {
    cleanupInactiveAbiDirs(nativeOutputRoot, activeAbis);
  }
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
    (
      $_.Name -ieq 'ninja.exe'
      -or $_.Name -ieq 'cmake.exe'
      -or $_.Name -ieq 'clang.exe'
      -or $_.Name -ieq 'clang++.exe'
      -or $_.Name -ieq 'ld.lld.exe'
    )
    -and $_.CommandLine
    -and $_.CommandLine -like "*$repoPath*"
  ) -or (
    $_.Name -ieq 'node.exe'
    -and $_.CommandLine
    -and (
      $_.CommandLine -like "*hvigorw.js*"
      -or $_.CommandLine -like "*daemon-process-boot-script.js*"
    )
  ) -or (
    $_.Name -ieq 'java.exe'
    -and $_.CommandLine
    -and $_.CommandLine -like "*hvigor-java-daemon.jar*"
  )
}

foreach ($target in $targets) {
  Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
}
`.trim();

  spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
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

function resolvePackageType() {
  const packageType = String(process.env.HARMONY_PACKAGE_TYPE ?? 'hap')
    .trim()
    .toLowerCase();

  if (packageType === 'app' || packageType === 'hap') {
    return packageType;
  }

  throw new Error(
    `Unsupported HARMONY_PACKAGE_TYPE="${packageType}". Expected "hap" or "app".`,
  );
}

function findBuiltArtifacts(rootDir, extension) {
  const artifacts = [];

  walkFilesRecursively(rootDir, filePath => {
    if (filePath.endsWith(extension)) {
      const stats = fs.statSync(filePath);
      artifacts.push({
        filePath,
        mtimeMs: stats.mtimeMs,
      });
    }
  });

  return artifacts.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) {
      return right.mtimeMs - left.mtimeMs;
    }

    return left.filePath.localeCompare(right.filePath);
  });
}

function pickBuiltArtifact(rootDir, packageType) {
  const extension = `.${packageType}`;
  const artifacts = findBuiltArtifacts(rootDir, extension);

  if (artifacts.length === 0) {
    throw new Error(
      `No ${packageType.toUpperCase()} artifact was produced under ${rootDir}`,
    );
  }

  const signedArtifact =
    artifacts.find(artifact =>
      path.basename(artifact.filePath).includes(`-signed${extension}`),
    ) ?? artifacts[0];

  return signedArtifact.filePath;
}

function writeGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function readHarmonyBuildLog() {
  if (!fs.existsSync(harmonyBuildLogPath)) {
    return '';
  }

  try {
    return fs.readFileSync(harmonyBuildLogPath, 'utf8');
  } catch {
    return '';
  }
}

function hasRetryableNativeBuildFailure(logContent) {
  if (logContent.includes('00303001 Configuration Error')) {
    return false;
  }

  return (
    logContent.includes('BuildNativeWithNinja') ||
    logContent.includes('ninja: build stopped: subcommand failed') ||
    logContent.includes('clang frontend command failed due to signal') ||
    logContent.includes('Exception Code: 0x80000004') ||
    logContent.includes('Native memory allocation (mmap) failed') ||
    logContent.includes('DOS error/errno=1455') ||
    logContent.includes('Exceptions happened while executing') ||
    logContent.includes('Failed to execute es2abc') ||
    logContent.includes('hvigor ERROR: 10311009 ArkTS: ERROR')
  );
}

function runAssembleHarmonyPackage({
  abiFilters,
  buildJobs,
  buildMode,
  hvigorPath,
  linkJobs,
  moduleName,
  nodePath,
  packageType,
  productName,
  requiredDeviceType,
}) {
  syncHarmonyEntryBuildProfile(buildJobs, linkJobs, abiFilters);
  const hvigorTask = packageType === 'app' ? 'assembleApp' : 'assembleHap';
  const hvigorArgs =
    packageType === 'app'
      ? [
          hvigorPath,
          '-p',
          `product=${productName}`,
          '-p',
          `buildMode=${buildMode}`,
          '-p',
          `requiredDeviceType=${requiredDeviceType}`,
          hvigorTask,
        ]
      : [
          hvigorPath,
          '-p',
          `module=${moduleName}@default`,
          '-p',
          `product=${productName}`,
          '-p',
          `buildMode=${buildMode}`,
          '-p',
          `requiredDeviceType=${requiredDeviceType}`,
          hvigorTask,
        ];

  console.log(
    `[harmony-build] native parallelism: compile=${buildJobs}, link=${linkJobs}`,
  );
  console.log(`[harmony-build] native abiFilters: ${abiFilters.join(', ')}`);
  console.log(`[harmony-build] package type: ${packageType}`);

  run(nodePath, hvigorArgs, {
    cwd: harmonyDir,
    env: {
      CMAKE_BUILD_PARALLEL_LEVEL: String(buildJobs),
      HARMONY_BUILD_JOBS: String(buildJobs),
      HARMONY_LINK_JOBS: String(linkJobs),
      HARMONY_ABI_FILTERS: abiFilters.join(','),
      JAVA_TOOL_OPTIONS: resolveJavaToolOptions(),
    },
    shell: false,
  });
}

function main() {
  const snapshots = snapshotExistingFiles([harmonyEntryBuildProfilePath]);
  try {
    ensureHarmonyBundleFresh();

    const { hvigorPath, nodePath, ohpmPath } = resolveDevEcoPaths();
    const buildMode = process.env.HARMONY_BUILD_MODE?.trim() || 'release';
    const moduleName = process.env.HARMONY_MODULE?.trim() || 'entry';
    const productName = process.env.HARMONY_PRODUCT?.trim() || 'default';
    const requiredDeviceType =
      process.env.HARMONY_REQUIRED_DEVICE_TYPE?.trim() || 'phone';
    const { buildJobs, linkJobs } = resolveNativeBuildParallelism();
    const abiFilters = resolveAbiFilters();
    const packageType = resolvePackageType();

    try {
      stopLingeringHarmonyBuildProcesses();
      cleanupNinjaFiles(moduleName);
      if (shouldCleanupInactiveAbiArtifacts()) {
        cleanupInactiveAbiArtifacts(moduleName, abiFilters);
      }

      if (shouldSkipOhpmInstall()) {
        console.log('[harmony-build] ohpm install skipped');
      } else {
        run(ohpmPath, ['install', '--all'], {
          cwd: harmonyDir,
          shell: false,
          stdio: 'pipe',
        });
      }
      runHarmonyDependencyPatches();

      runAssembleHarmonyPackage({
        abiFilters,
        buildJobs,
        buildMode,
        hvigorPath,
        linkJobs,
        moduleName,
        nodePath,
        packageType,
        productName,
        requiredDeviceType,
      });
    } catch (error) {
      const fallback = resolveFallbackBuildJobs(buildJobs, linkJobs);
      const buildLog = readHarmonyBuildLog();

      if (!fallback || !hasRetryableNativeBuildFailure(buildLog)) {
        throw error;
      }

      console.warn(
        `[harmony-build] Native build failed. Retrying once with lower parallelism: compile=${fallback.buildJobs}, link=${fallback.linkJobs}`,
      );
      stopLingeringHarmonyBuildProcesses();
      cleanupNinjaFiles(moduleName, 'recovery');

      runAssembleHarmonyPackage({
        abiFilters,
        buildJobs: fallback.buildJobs,
        buildMode,
        hvigorPath,
        linkJobs: fallback.linkJobs,
        moduleName,
        nodePath,
        packageType,
        productName,
        requiredDeviceType,
      });
    }

    const outputDir =
      packageType === 'app'
        ? harmonyDir
        : path.join(
            harmonyDir,
            moduleName,
            'build',
            'default',
            'outputs',
            'default',
          );

    ensurePathExists(
      outputDir,
      `Harmony ${packageType.toUpperCase()} output root`,
    );

    const artifactPath = pickBuiltArtifact(outputDir, packageType);

    console.log(
      `[harmony-build] artifact=${path.relative(repoRoot, artifactPath)}`,
    );
    writeGithubOutput('artifact_path', artifactPath);
    writeGithubOutput(`${packageType}_path`, artifactPath);
  } finally {
    restoreFileSnapshots(snapshots);
  }
}

main();
