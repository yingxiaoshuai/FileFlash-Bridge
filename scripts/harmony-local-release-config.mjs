import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const defaultConfigPath = path.join(
  repoRoot,
  'config',
  'harmony-release.local.json',
);
const signingRootDir = path.join(repoRoot, 'harmony', '.release-signing');

function ensureText(value) {
  return String(value ?? '').trim();
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPlaceholderValue(value) {
  const normalized = ensureText(value).toUpperCase();
  return (
    normalized === 'PASTE_BASE64_JSON_HERE' ||
    normalized === 'PASTE_BASE64_ZIP_HERE'
  );
}

function resolveLocalConfigPath() {
  const configuredPath = ensureText(process.env.HARMONY_LOCAL_RELEASE_CONFIG_PATH);
  if (!configuredPath) {
    return defaultConfigPath;
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(repoRoot, configuredPath);
}

function readLocalConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing Harmony local release config: ${configPath}\nCopy config/harmony-release.local.example.json to config/harmony-release.local.json and fill in your private values.`,
    );
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Failed to parse Harmony local release config: ${configPath}\n${error.message}`,
    );
  }
}

function resolveConfigRelativePath(configPath, targetPath, label) {
  const trimmedPath = ensureText(targetPath);

  if (!trimmedPath) {
    throw new Error(`${label} is required in ${configPath}`);
  }

  const resolvedPath = path.isAbsolute(trimmedPath)
    ? trimmedPath
    : path.resolve(path.dirname(configPath), trimmedPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`${label} does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}

function validateReleaseConfig(config, label) {
  for (const field of [
    'bundleName',
    'storePassword',
    'keyAlias',
    'keyPassword',
  ]) {
    if (!ensureText(config[field])) {
      throw new Error(`${label} is missing required field: ${field}`);
    }
  }

  return config;
}

function parseReleaseConfigValue(rawValue, label) {
  if (isObject(rawValue)) {
    return validateReleaseConfig(rawValue, label);
  }

  const rawText = ensureText(rawValue);
  if (!rawText) {
    throw new Error(`${label} is empty.`);
  }

  if (isPlaceholderValue(rawText)) {
    throw new Error(
      `${label} is still using the example placeholder. Replace it with real data or switch to the simpler local file format described in docs/harmony-local-release.md.`,
    );
  }

  if (rawText.startsWith('{')) {
    try {
      return validateReleaseConfig(JSON.parse(rawText), label);
    } catch (error) {
      throw new Error(`${label} is not valid JSON: ${error.message}`);
    }
  }

  const rawJson = decodeUtf8Base64(rawText, label);

  try {
    return validateReleaseConfig(JSON.parse(rawJson), label);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function resolveDirectReleaseConfig(config) {
  if (isObject(config.releaseConfig)) {
    return config.releaseConfig;
  }

  if (
    ['bundleName', 'storePassword', 'keyAlias', 'keyPassword'].some(field =>
      hasOwn(config, field),
    )
  ) {
    return {
      bundleName: config.bundleName,
      storePassword: config.storePassword,
      keyAlias: config.keyAlias,
      keyPassword: config.keyPassword,
      vendor: config.vendor,
      signingName: config.signingName,
      signAlg: config.signAlg,
    };
  }

  return null;
}

function resolveDirectSigningConfig(config) {
  if (isObject(config.signing)) {
    return config.signing;
  }

  if (
    ['certPath', 'profilePath', 'storeFilePath'].some(field =>
      hasOwn(config, field),
    )
  ) {
    return {
      certPath: config.certPath,
      profilePath: config.profilePath,
      storeFilePath: config.storeFilePath,
    };
  }

  return null;
}

function resolveLocalSecretValues() {
  const releaseConfigBase64 = ensureText(
    process.env.HARMONY_RELEASE_CONFIG_JSON_BASE64,
  );
  const signingArchiveBase64 = ensureText(
    process.env.HARMONY_SIGNING_ARCHIVE_BASE64,
  );

  if (releaseConfigBase64 || signingArchiveBase64) {
    if (!releaseConfigBase64 || !signingArchiveBase64) {
      throw new Error(
        'HARMONY_RELEASE_CONFIG_JSON_BASE64 and HARMONY_SIGNING_ARCHIVE_BASE64 must be provided together.',
      );
    }

    return {
      configPath: null,
      releaseConfigBase64,
      signingArchiveBase64,
      source: 'environment',
    };
  }

  const configPath = resolveLocalConfigPath();
  const config = readLocalConfigFile(configPath);
  const directReleaseConfig = resolveDirectReleaseConfig(config);
  const directSigningConfig = resolveDirectSigningConfig(config);

  if (directReleaseConfig || directSigningConfig) {
    if (!directReleaseConfig || !directSigningConfig) {
      throw new Error(
        `Harmony local release config is incomplete: ${configPath}\nWhen using the simple local format, both releaseConfig and signing paths are required.`,
      );
    }

    return {
      config,
      configPath,
      source: 'file-direct',
      mode: 'direct',
    };
  }

  const fileReleaseConfigBase64 = ensureText(
    config.HARMONY_RELEASE_CONFIG_JSON_BASE64,
  );
  const fileSigningArchiveBase64 = ensureText(
    config.HARMONY_SIGNING_ARCHIVE_BASE64,
  );

  if (!fileReleaseConfigBase64 || !fileSigningArchiveBase64) {
    throw new Error(
      `Harmony local release config is incomplete: ${configPath}\nBoth HARMONY_RELEASE_CONFIG_JSON_BASE64 and HARMONY_SIGNING_ARCHIVE_BASE64 are required.`,
    );
  }

  return {
    configPath,
    config,
    releaseConfigBase64: fileReleaseConfigBase64,
    signingArchiveBase64: fileSigningArchiveBase64,
    source: 'file-base64',
    mode: 'base64',
  };
}

function decodeUtf8Base64(encodedValue, label) {
  try {
    return Buffer.from(encodedValue, 'base64').toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decode ${label}: ${error.message}`);
  }
}

function parseReleaseConfig(encodedValue) {
  return parseReleaseConfigValue(
    encodedValue,
    'HARMONY_RELEASE_CONFIG_JSON_BASE64',
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    shell: false,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? 1}: ${command}`,
    );
  }
}

function extractArchive(archivePath, destinationPath) {
  fs.rmSync(destinationPath, { force: true, recursive: true });
  fs.mkdirSync(destinationPath, { recursive: true });

  if (process.platform === 'win32') {
    const escapedArchivePath = archivePath.replace(/'/g, "''");
    const escapedDestinationPath = destinationPath.replace(/'/g, "''");
    run('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${escapedArchivePath}' -DestinationPath '${escapedDestinationPath}' -Force`,
    ]);
    return;
  }

  run('unzip', ['-o', archivePath, '-d', destinationPath]);
}

function findFileRecursive(rootPath, fileName) {
  if (!fs.existsSync(rootPath)) {
    return null;
  }

  const stack = [rootPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.name === fileName) {
        return fullPath;
      }
    }
  }

  return null;
}

function restoreSigningArchive(encodedValue) {
  if (isPlaceholderValue(encodedValue)) {
    throw new Error(
      'HARMONY_SIGNING_ARCHIVE_BASE64 is still using the example placeholder. Replace it with real data or switch to the simpler local file format described in docs/harmony-local-release.md.',
    );
  }

  fs.rmSync(signingRootDir, { force: true, recursive: true });
  fs.mkdirSync(signingRootDir, { recursive: true });

  const archivePath = path.join(signingRootDir, 'signing.zip');
  const extractedDir = path.join(signingRootDir, 'files');

  fs.writeFileSync(archivePath, Buffer.from(encodedValue, 'base64'));
  extractArchive(archivePath, extractedDir);

  const certPath = findFileRecursive(extractedDir, 'distribution.cer');
  const profilePath = findFileRecursive(extractedDir, 'distribution.p7b');
  const storeFilePath = findFileRecursive(extractedDir, 'distribution.p12');

  if (!certPath || !profilePath || !storeFilePath) {
    throw new Error(
      'Harmony signing archive must contain distribution.cer, distribution.p7b, and distribution.p12.',
    );
  }

  return {
    certPath,
    profilePath,
    signingDir: signingRootDir,
    storeFilePath,
  };
}

function resolveSigningFilesFromConfig(configPath, signingConfig) {
  return {
    certPath: resolveConfigRelativePath(
      configPath,
      signingConfig.certPath,
      'signing.certPath',
    ),
    profilePath: resolveConfigRelativePath(
      configPath,
      signingConfig.profilePath,
      'signing.profilePath',
    ),
    signingDir: path.dirname(
      resolveConfigRelativePath(
        configPath,
        signingConfig.storeFilePath,
        'signing.storeFilePath',
      ),
    ),
    storeFilePath: resolveConfigRelativePath(
      configPath,
      signingConfig.storeFilePath,
      'signing.storeFilePath',
    ),
  };
}

export function prepareLocalHarmonyReleaseEnv() {
  const {
    config,
    configPath,
    mode,
    releaseConfigBase64,
    signingArchiveBase64,
    source,
  } = resolveLocalSecretValues();
  const releaseConfig =
    mode === 'direct'
      ? validateReleaseConfig(resolveDirectReleaseConfig(config), 'releaseConfig')
      : parseReleaseConfig(releaseConfigBase64);
  const signingFiles =
    mode === 'direct'
      ? resolveSigningFilesFromConfig(configPath, resolveDirectSigningConfig(config))
      : restoreSigningArchive(signingArchiveBase64);

  if (releaseConfigBase64) {
    process.env.HARMONY_RELEASE_CONFIG_JSON_BASE64 = releaseConfigBase64;
  }

  if (signingArchiveBase64) {
    process.env.HARMONY_SIGNING_ARCHIVE_BASE64 = signingArchiveBase64;
  }

  process.env.HARMONY_APP_BUNDLE_NAME = ensureText(releaseConfig.bundleName);
  process.env.HARMONY_SIGNING_STORE_PASSWORD = ensureText(
    releaseConfig.storePassword,
  );
  process.env.HARMONY_SIGNING_KEY_ALIAS = ensureText(releaseConfig.keyAlias);
  process.env.HARMONY_SIGNING_KEY_PASSWORD = ensureText(
    releaseConfig.keyPassword,
  );
  process.env.HARMONY_SIGNING_NAME = ensureText(releaseConfig.signingName)
    ? ensureText(releaseConfig.signingName)
    : 'default';
  process.env.HARMONY_SIGNING_SIGN_ALG = ensureText(releaseConfig.signAlg)
    ? ensureText(releaseConfig.signAlg)
    : 'SHA256withECDSA';
  process.env.HARMONY_SIGNING_CERT_PATH = signingFiles.certPath;
  process.env.HARMONY_SIGNING_PROFILE_PATH = signingFiles.profilePath;
  process.env.HARMONY_SIGNING_STORE_FILE_PATH = signingFiles.storeFilePath;

  if (ensureText(releaseConfig.vendor)) {
    process.env.HARMONY_APP_VENDOR = ensureText(releaseConfig.vendor);
  }

  return {
    bundleName: process.env.HARMONY_APP_BUNDLE_NAME,
    configPath,
    mode,
    signingDir: signingFiles.signingDir,
    source,
  };
}
