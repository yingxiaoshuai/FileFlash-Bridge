import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const harmonyEntryBuildProfilePath = path.join(
  process.cwd(),
  'harmony',
  'entry',
  'build-profile.json5',
);
const harmonyBuildLogPath = path.join(
  process.cwd(),
  'harmony',
  '.hvigor',
  'outputs',
  'build-logs',
  'build.log',
);
const hdcExecutableName = process.platform === 'win32' ? 'hdc.exe' : 'hdc';

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveBuildJobs() {
  const logicalCores =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length;

  const defaultBuildJobs = Math.max(
    4,
    Math.min(12, Math.floor(logicalCores * 0.6)),
  );
  const buildJobs =
    parsePositiveInt(process.env.CMAKE_BUILD_PARALLEL_LEVEL) ??
    parsePositiveInt(process.env.HARMONY_BUILD_JOBS) ??
    defaultBuildJobs;

  const defaultLinkJobs = Math.max(1, Math.min(2, Math.floor(buildJobs / 6)));
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
  const normalized = String(value ?? '').trim().toLowerCase();

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

function resolveAbiFilters() {
  const hdcPath = resolveHdcPath();
  const connectedTargets = getConnectedHdcTargets(hdcPath);

  for (const target of connectedTargets) {
    const abiFilters = getTargetAbiFilters(hdcPath, target);
    if (abiFilters.length > 0) {
      return abiFilters;
    }
  }

  // If no device is connected yet, keep both ABIs so the CLI can still boot a simulator.
  return ['arm64-v8a', 'x86_64'];
}

function resolveFallbackBuildJobs(buildJobs, linkJobs) {
  const nextBuildJobs =
    buildJobs > 8 ? 8 : buildJobs > 4 ? Math.max(4, buildJobs - 2) : buildJobs;
  const nextLinkJobs = Math.max(1, Math.min(linkJobs, 1));

  if (nextBuildJobs === buildJobs && nextLinkJobs === linkJobs) {
    return null;
  }

  return {
    buildJobs: nextBuildJobs,
    linkJobs: nextLinkJobs,
  };
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

function printRecoveryHint(buildJobs, linkJobs) {
  console.error('[harmony-build] ArkTS compiler still failed after retry.');
  console.error('[harmony-build] Recommended recovery:');
  console.error('  npm run harmony:clean');
  console.error(`  $env:HARMONY_BUILD_JOBS='${buildJobs}'`);
  console.error(`  $env:HARMONY_LINK_JOBS='${linkJobs}'`);
  console.error('  npm run harmony:run -- --no-packager');
}

function runHarmony(buildJobs, linkJobs, abiFilters) {
  syncHarmonyEntryBuildProfile(buildJobs, linkJobs, abiFilters);
  console.log(
    `[harmony-build] native parallelism: compile=${buildJobs}, link=${linkJobs}`,
  );
  console.log(`[harmony-build] native abiFilters: ${abiFilters.join(', ')}`);

  const args = [
    'run-harmony',
    '--harmony-project-path',
    './harmony',
    ...process.argv.slice(2),
  ];

  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CMAKE_BUILD_PARALLEL_LEVEL: String(buildJobs),
        HARMONY_BUILD_JOBS: String(buildJobs),
        HARMONY_LINK_JOBS: String(linkJobs),
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
  const { buildJobs, linkJobs } = resolveBuildJobs();
  const abiFilters = resolveAbiFilters();
  const firstExitCode = await runHarmony(buildJobs, linkJobs, abiFilters);

  if (firstExitCode === 0) {
    process.exit(0);
  }

  const buildLog = readHarmonyBuildLog();
  const fallback = resolveFallbackBuildJobs(buildJobs, linkJobs);

  if (!fallback || !hasEs2abcFailure(buildLog)) {
    process.exit(firstExitCode);
  }

  console.warn(
    '[harmony-build] Detected an ArkTS es2abc failure. Retrying once with lower parallelism...',
  );

  const secondExitCode = await runHarmony(
    fallback.buildJobs,
    fallback.linkJobs,
    abiFilters,
  );

  if (secondExitCode !== 0) {
    printRecoveryHint(fallback.buildJobs, fallback.linkJobs);
  }

  process.exit(secondExitCode);
}

await main();
