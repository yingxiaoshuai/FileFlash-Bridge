import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.cwd();
const bundlePath = path.join(
  repoRoot,
  'harmony',
  'entry',
  'src',
  'main',
  'resources',
  'rawfile',
  'bundle.harmony.js',
);
const sourceRoots = [
  path.join(repoRoot, 'src'),
  path.join(repoRoot, 'index.js'),
  path.join(repoRoot, 'App.tsx'),
  path.join(repoRoot, 'babel.config.js'),
  path.join(repoRoot, 'metro.config.js'),
];
const requiredRuntimeSnippets = [
  'FPFileAccess',
  'readFileChunk',
  'saveFileToDocuments',
  'resolved from NativeModules',
  'TurboModuleRegistry',
];
const staleRuntimeSnippets = [
  '当前鸿蒙安装包缺少原生文件模块',
  'copyTo:"cachesDirectory"',
  "copyTo:'cachesDirectory'",
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function shouldSkip() {
  const value = String(process.env.HARMONY_SKIP_BUNDLE_FRESHNESS ?? '')
    .trim()
    .toLowerCase();

  return (
    hasFlag('--skip') ||
    value === '1' ||
    value === 'true' ||
    value === 'yes'
  );
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function formatTime(mtimeMs) {
  return new Date(mtimeMs).toISOString();
}

function walkFiles(rootPath, visitor) {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  const stats = fs.statSync(rootPath);
  if (stats.isFile()) {
    visitor(rootPath, stats);
    return;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === '__mocks__' ||
        entry.name === 'test-support'
      ) {
        continue;
      }
      walkFiles(entryPath, visitor);
      continue;
    }

    if (entry.isFile()) {
      visitor(entryPath, fs.statSync(entryPath));
    }
  }
}

function isRuntimeSource(filePath) {
  return /\.(cjs|js|jsx|json|mjs|ts|tsx)$/i.test(filePath);
}

function findNewestRuntimeSource() {
  let newest = null;

  for (const rootPath of sourceRoots) {
    walkFiles(rootPath, (filePath, stats) => {
      if (!isRuntimeSource(filePath)) {
        return;
      }

      if (!newest || stats.mtimeMs > newest.mtimeMs) {
        newest = {
          filePath,
          mtimeMs: stats.mtimeMs,
        };
      }
    });
  }

  return newest;
}

function checkBundleContent(bundleContent) {
  const missingSnippets = requiredRuntimeSnippets.filter(
    snippet => !bundleContent.includes(snippet),
  );
  if (missingSnippets.length > 0) {
    throw new Error(
      [
        'Harmony JS bundle does not contain the fixed FPFileAccess runtime path.',
        `Missing snippets: ${missingSnippets.join(', ')}`,
        'Run: npm run harmony:bundle',
      ].join('\n'),
    );
  }

  const staleSnippets = staleRuntimeSnippets.filter(snippet =>
    bundleContent.includes(snippet),
  );
  if (staleSnippets.length > 0) {
    throw new Error(
      [
        'Harmony JS bundle still contains stale file-access code.',
        `Stale snippets: ${staleSnippets.join(', ')}`,
        'Run: npm run harmony:bundle',
      ].join('\n'),
    );
  }
}

export function ensureHarmonyBundleFresh(options = {}) {
  if (shouldSkip()) {
    console.warn('[harmony-bundle] freshness check skipped');
    return;
  }

  if (!fs.existsSync(bundlePath)) {
    throw new Error(
      `Missing Harmony JS bundle: ${relativePath(bundlePath)}\nRun: npm run harmony:bundle`,
    );
  }

  const bundleStats = fs.statSync(bundlePath);
  const newestSource = findNewestRuntimeSource();
  const toleranceMs = 2000;

  if (
    !options.skipMtime &&
    newestSource &&
    newestSource.mtimeMs > bundleStats.mtimeMs + toleranceMs
  ) {
    throw new Error(
      [
        'Harmony JS bundle is older than runtime source changes.',
        `Newest source: ${relativePath(newestSource.filePath)} (${formatTime(
          newestSource.mtimeMs,
        )})`,
        `Bundle: ${relativePath(bundlePath)} (${formatTime(
          bundleStats.mtimeMs,
        )})`,
        'Run: npm run harmony:bundle',
      ].join('\n'),
    );
  }

  const bundleContent = fs.readFileSync(bundlePath, 'utf8');
  checkBundleContent(bundleContent);

  console.log(
    `[harmony-bundle] fresh: ${relativePath(bundlePath)} (${formatTime(
      bundleStats.mtimeMs,
    )})`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ensureHarmonyBundleFresh({
    skipMtime: hasFlag('--skip-mtime'),
  });
}
