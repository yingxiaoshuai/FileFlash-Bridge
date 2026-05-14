import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureDevEcoSdkHome } from './harmonySdk.mjs';
import { ensureHarmonyBundleFresh } from './ensure-harmony-bundle-fresh.mjs';
import {
  cleanupLocalHarmonyReleaseArtifacts,
  prepareLocalHarmonyReleaseEnv,
} from './harmony-local-release-config.mjs';

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
const defaultLocalReleaseConfigPath = path.join(
  repoRoot,
  'config',
  'harmony-release.local.json',
);
const trackedConfigPaths = [
  path.join(harmonyDir, 'AppScope', 'app.json5'),
  path.join(harmonyDir, 'build-profile.json5'),
  path.join(harmonyDir, 'entry', 'build-profile.json5'),
  path.join(harmonyDir, 'entry', 'src', 'main', 'module.json5'),
];
const nativeAbiNames = new Set(['arm64-v8a', 'x86_64']);
const normalNinjaFileNames = new Set(['.ninja_lock']);
const recoveryNinjaFileNames = new Set([
  '.ninja_deps',
  '.ninja_lock',
  '.ninja_log',
  '.ninja_log.restat',
  'output.log',
]);
const internalCliFlags = new Set(['--clean-inactive-abi']);
const hdcExecutableName = process.platform === 'win32' ? 'hdc.exe' : 'hdc';

ensureDevEcoSdkHome();

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveBuildJobs() {
  const logicalCores =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length;

  const defaultBuildJobs =
    process.platform === 'win32'
      ? 2
      : Math.max(4, Math.min(12, Math.floor(logicalCores * 0.6)));
  const buildJobs =
    parsePositiveInt(process.env.CMAKE_BUILD_PARALLEL_LEVEL) ??
    parsePositiveInt(process.env.HARMONY_BUILD_JOBS) ??
    defaultBuildJobs;

  const defaultLinkJobs =
    process.platform === 'win32'
      ? 1
      : Math.max(1, Math.min(2, Math.floor(buildJobs / 6)));
  const linkJobs =
    parsePositiveInt(process.env.HARMONY_LINK_JOBS) ?? defaultLinkJobs;

  return {
    buildJobs,
    linkJobs,
  };
}

function resolveHdcPath() {
  const sdkHome = process.env.DEVECO_SDK_HOME;
  if (!sdkHome) {
    return null;
  }

  return path.join(
    sdkHome,
    'default',
    'openharmony',
    'toolchains',
    hdcExecutableName,
  );
}

function normalizeAbiToken(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('x86_64')) {
    return 'x86_64';
  }

  if (normalized.includes('arm64-v8a') || normalized.includes('arm64')) {
    return 'arm64-v8a';
  }

  return null;
}

function getConnectedHdcTargets(hdcPath) {
  if (!hdcPath || !fs.existsSync(hdcPath)) {
    return [];
  }

  try {
    const stdout = execFileSync(hdcPath, ['list', 'targets'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.includes('[Empty]'));
  } catch {
    return [];
  }
}

function getTargetAbiFilters(hdcPath, target) {
  try {
    const stdout = execFileSync(
      hdcPath,
      ['-t', target, 'shell', 'param', 'get', 'const.product.cpu.abilist'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );

    const abiFilters = stdout
      .split(/[,\r\n]+/)
      .map(normalizeAbiToken)
      .filter(Boolean);

    return [...new Set(abiFilters)];
  } catch {
    return [];
  }
}

function setupLocalBrowserForwarding() {
  if (String(process.env.HARMONY_ENABLE_BROWSER_FPORT ?? '1') === '0') {
    return;
  }

  const hdcPath = resolveHdcPath();
  const port =
    parsePositiveInt(process.env.HARMONY_BROWSER_FORWARD_PORT) ?? 8668;
  const connectedTargets = getConnectedHdcTargets(hdcPath);

  if (!hdcPath || !fs.existsSync(hdcPath) || connectedTargets.length === 0) {
    return;
  }

  for (const target of connectedTargets) {
    try {
      execFileSync(
        hdcPath,
        ['-t', target, 'fport', 'rm', `tcp:${port}`, `tcp:${port}`],
        {
          cwd: repoRoot,
          stdio: 'ignore',
        },
      );
    } catch {
      // The rule may not exist yet.
    }

    try {
      execFileSync(
        hdcPath,
        ['-t', target, 'fport', `tcp:${port}`, `tcp:${port}`],
        {
          cwd: repoRoot,
          stdio: 'ignore',
        },
      );
      console.log(
        `[harmony-build] browser forward: http://127.0.0.1:${port} -> ${target}:${port}`,
      );
    } catch (error) {
      console.warn(
        `[harmony-build] browser forward failed for ${target}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function resolveAbiFilters() {
  const configuredValue = String(process.env.HARMONY_ABI_FILTERS ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (configuredValue.length > 0) {
    return configuredValue;
  }

  const hdcPath = resolveHdcPath();
  const connectedTargets = getConnectedHdcTargets(hdcPath);

  for (const target of connectedTargets) {
    const abiFilters = getTargetAbiFilters(hdcPath, target);
    if (abiFilters.length > 0) {
      return abiFilters;
    }
  }

  // If no device is connected yet, prefer the local simulator ABI and avoid
  // building two native trees on Windows, which can exhaust the page file.
  return ['x86_64'];
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

function getForwardedReactNativeArgs() {
  return process.argv.slice(2).filter(arg => !internalCliFlags.has(arg));
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
  if (process.platform !== 'win32') {
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
    -and $_.CommandLine -like "*daemon-process-boot-script.js*"
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
    stdio: 'ignore',
  });
}

function shouldUseLocalSigningConfig() {
  const configuredPath = String(
    process.env.HARMONY_LOCAL_RELEASE_CONFIG_PATH ?? '',
  ).trim();

  if (configuredPath) {
    return true;
  }

  if (
    String(process.env.HARMONY_RELEASE_CONFIG_JSON_BASE64 ?? '').trim() ||
    String(process.env.HARMONY_SIGNING_ARCHIVE_BASE64 ?? '').trim()
  ) {
    return true;
  }

  return fs.existsSync(defaultLocalReleaseConfigPath);
}

function runConfigureHarmonyProject() {
  execFileSync(process.execPath, ['scripts/configure-harmony-project.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

function runHarmonyDependencyPatches() {
  for (const patchScript of [
    'scripts/patch-harmony-react-native-fs.mjs',
    'scripts/patch-harmony-react-native-tcp-socket.mjs',
  ]) {
    execFileSync(process.execPath, [patchScript], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
  }
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

  const currentContent = fs.readFileSync(harmonyEntryBuildProfilePath, 'utf8');
  const abiFiltersLiteral = abiFilters.map(abi => `"${abi}"`).join(', ');
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

const command =
  process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', '.bin', 'react-native.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'react-native');

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

function hasEs2abcFailure(logContent) {
  return (
    logContent.includes('Failed to execute es2abc') ||
    logContent.includes('hvigor ERROR: 10311009 ArkTS: ERROR')
  );
}

function hasNativeNinjaFailure(logContent) {
  return (
    logContent.includes('BuildNativeWithNinja') ||
    logContent.includes('ninja: build stopped: subcommand failed') ||
    logContent.includes('clang frontend command failed due to signal') ||
    logContent.includes('Exception Code: 0x80000004') ||
    logContent.includes('Native memory allocation (mmap) failed') ||
    logContent.includes('DOS error/errno=1455') ||
    logContent.includes('Exceptions happened while executing')
  );
}

function printRecoveryHint(buildJobs, linkJobs) {
  console.error('[harmony-build] Harmony build still failed after retry.');
  console.error('[harmony-build] Recommended recovery:');
  console.error('  npm run harmony:clean');
  console.error(`  $env:HARMONY_BUILD_JOBS='${buildJobs}'`);
  console.error(`  $env:HARMONY_LINK_JOBS='${linkJobs}'`);
  console.error('  npm run harmony:run -- --no-packager');
}

function runHarmony(buildJobs, linkJobs, abiFilters) {
  stopLingeringHarmonyBuildProcesses();
  cleanupNinjaFiles('entry');
  if (shouldCleanupInactiveAbiArtifacts()) {
    cleanupInactiveAbiArtifacts('entry', abiFilters);
  }
  syncHarmonyEntryBuildProfile(buildJobs, linkJobs, abiFilters);
  runHarmonyDependencyPatches();
  console.log(
    `[harmony-build] native parallelism: compile=${buildJobs}, link=${linkJobs}`,
  );
  console.log(`[harmony-build] native abiFilters: ${abiFilters.join(', ')}`);

  const args = [
    'run-harmony',
    '--harmony-project-path',
    './harmony',
    ...getForwardedReactNativeArgs(),
  ];

  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CMAKE_BUILD_PARALLEL_LEVEL: String(buildJobs),
        HARMONY_BUILD_JOBS: String(buildJobs),
        HARMONY_LINK_JOBS: String(linkJobs),
        JAVA_TOOL_OPTIONS: resolveJavaToolOptions(),
      },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    child.on('exit', code => {
      resolve(code ?? 1);
    });

    child.on('error', error => {
      console.error(error);
      resolve(1);
    });
  });
}

async function main() {
  const snapshots = snapshotFiles(trackedConfigPaths);
  const { buildJobs, linkJobs } = resolveBuildJobs();
  const abiFilters = resolveAbiFilters();
  let exitCode = 0;

  try {
    if (shouldUseLocalSigningConfig()) {
      const prepared = prepareLocalHarmonyReleaseEnv();
      console.log(
        `[harmony-build] signing source=${prepared.source} mode=${prepared.mode}`,
      );
      runConfigureHarmonyProject();
    } else {
      console.log('[harmony-build] signing source=existing');
    }

    ensureHarmonyBundleFresh();

    const firstExitCode = await runHarmony(buildJobs, linkJobs, abiFilters);

    if (firstExitCode === 0) {
      setupLocalBrowserForwarding();
      exitCode = 0;
      return;
    }

    const buildLog = readHarmonyBuildLog();
    const fallback = resolveFallbackBuildJobs(buildJobs, linkJobs);

    const isEs2abcFailure = hasEs2abcFailure(buildLog);
    const isNativeNinjaFailure = hasNativeNinjaFailure(buildLog);

    if (!fallback || (!isEs2abcFailure && !isNativeNinjaFailure)) {
      exitCode = firstExitCode;
      return;
    }

    const failureType = isEs2abcFailure ? 'ArkTS es2abc' : 'native ninja';
    console.warn(
      `[harmony-build] Detected a ${failureType} failure. Retrying once with lower parallelism...`,
    );
    cleanupNinjaFiles('entry', 'recovery');

    const secondExitCode = await runHarmony(
      fallback.buildJobs,
      fallback.linkJobs,
      abiFilters,
    );

    if (secondExitCode !== 0) {
      printRecoveryHint(fallback.buildJobs, fallback.linkJobs);
    } else {
      setupLocalBrowserForwarding();
    }

    exitCode = secondExitCode;
  } finally {
    restoreFiles(snapshots);
    cleanupLocalHarmonyReleaseArtifacts();
  }

  process.exit(exitCode);
}

await main();
