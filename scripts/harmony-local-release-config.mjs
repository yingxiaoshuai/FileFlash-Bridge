import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ensureDevEcoSdkHome } from './harmonySdk.mjs';

const repoRoot = process.cwd();
const defaultConfigPath = path.join(
  repoRoot,
  'config',
  'harmony-release.local.json',
);
const signingRootDir = path.join(repoRoot, 'harmony', '.release-signing');
const stagedSigningDir = path.join(signingRootDir, 'staged');
const harmonyMaterialComponent = Buffer.from([
  49,
  243,
  9,
  115,
  214,
  175,
  91,
  184,
  211,
  190,
  177,
  88,
  101,
  131,
  192,
  119,
]);

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

function pickExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (candidatePath && fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
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
    if (label === 'signing.profilePath') {
      throw new Error(
        `${label} does not exist: ${resolvedPath}\nHarmony release signing also requires a provisioning profile (.p7b). Export or download the profile from DevEco Studio / AppGallery Connect and place it at this path, or switch to signing.directory auto-detection.`,
      );
    }

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
    ['directory', 'certPath', 'profilePath', 'storeFilePath'].some(field =>
      hasOwn(config, field),
    )
  ) {
    return {
      directory: config.directory,
      certPath: config.certPath,
      profilePath: config.profilePath,
      storeFilePath: config.storeFilePath,
    };
  }

  return null;
}

function findFirstMatchingFile(rootPath, extensions) {
  if (!rootPath || !fs.existsSync(rootPath)) {
    return null;
  }

  const normalizedExtensions = extensions.map(extension =>
    extension.toLowerCase(),
  );
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

      const extension = path.extname(entry.name).toLowerCase();
      if (normalizedExtensions.includes(extension)) {
        return fullPath;
      }
    }
  }

  return null;
}

function resolveSigningDirectory(configPath, signingConfig) {
  const directoryValue = ensureText(signingConfig.directory);
  if (!directoryValue) {
    return null;
  }

  const resolvedDirectory = path.isAbsolute(directoryValue)
    ? directoryValue
    : path.resolve(path.dirname(configPath), directoryValue);

  if (!fs.existsSync(resolvedDirectory)) {
    throw new Error(`signing.directory does not exist: ${resolvedDirectory}`);
  }

  return resolvedDirectory;
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

function ensureCleanDirectory(directoryPath) {
  fs.rmSync(directoryPath, { force: true, recursive: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function resolveDevEcoToolsDir() {
  const sdkHome = ensureDevEcoSdkHome();

  if (!sdkHome) {
    throw new Error(
      'DevEco SDK could not be resolved while preparing Harmony signing materials. Set DEVECO_SDK_HOME first.',
    );
  }

  const toolsDir = pickExistingPath([
    path.resolve(sdkHome, '..', 'tools'),
    path.resolve(sdkHome, '..', '..', 'tools'),
  ]);

  if (!toolsDir) {
    throw new Error(
      `Unable to resolve the DevEco tools directory from ${sdkHome}.`,
    );
  }

  return toolsDir;
}

function resolveHvigorMaterialDir() {
  const materialDir = path.join(
    resolveDevEcoToolsDir(),
    'hvigor',
    'hvigor-ohos-plugin',
    'res',
    'material',
  );

  if (!fs.existsSync(materialDir)) {
    throw new Error(
      `Unable to find the hvigor signing material directory: ${materialDir}`,
    );
  }

  return materialDir;
}

function stageSigningFiles(signingFiles) {
  ensureCleanDirectory(stagedSigningDir);

  const certPath = path.join(stagedSigningDir, 'distribution.cer');
  const profilePath = path.join(stagedSigningDir, 'distribution.p7b');
  const storeFilePath = path.join(stagedSigningDir, 'distribution.p12');
  const materialPath = path.join(stagedSigningDir, 'material');

  fs.copyFileSync(signingFiles.certPath, certPath);
  fs.copyFileSync(signingFiles.profilePath, profilePath);
  fs.copyFileSync(signingFiles.storeFilePath, storeFilePath);
  fs.cpSync(resolveHvigorMaterialDir(), materialPath, {
    force: true,
    recursive: true,
  });

  return {
    certPath,
    profilePath,
    signingDir: stagedSigningDir,
    storeFilePath,
  };
}

function listDirectoryEntries(directoryPath, label) {
  if (
    !fs.existsSync(directoryPath) ||
    !fs.statSync(directoryPath).isDirectory()
  ) {
    throw new Error(`${label} is missing or not a directory: ${directoryPath}`);
  }

  return fs.readdirSync(directoryPath).filter(name => name !== '.DS_Store');
}

function readMaterialFileBytes(directoryPath, label) {
  const entries = listDirectoryEntries(directoryPath, label);

  if (entries.length !== 1) {
    throw new Error(`${label} must contain exactly one file: ${directoryPath}`);
  }

  return fs.readFileSync(path.join(directoryPath, entries[0]));
}

function xorBuffers(left, right, label) {
  if (left.length !== right.length) {
    throw new Error(`Harmony signing material length mismatch: ${label}`);
  }

  const result = Buffer.alloc(left.length);

  for (let index = 0; index < left.length; index += 1) {
    result[index] = left[index] ^ right[index];
  }

  return result;
}

function xorMaterialComponents(components, label) {
  if (components.some(component => component.length !== 16)) {
    throw new Error(`Harmony signing material is invalid: ${label}`);
  }

  let result = Buffer.from(components[0]);

  for (let index = 1; index < components.length; index += 1) {
    result = xorBuffers(result, components[index], label);
  }

  return result;
}

function decryptHarmonyPayload(key, payload, label) {
  if (payload.length < 32) {
    throw new Error(`Harmony signing payload is too short: ${label}`);
  }

  const encryptedSectionLength = payload.readUInt32BE(0);
  const ivLength = payload.length - 4 - encryptedSectionLength;

  if (ivLength <= 0 || payload.length < 4 + ivLength + 16) {
    throw new Error(`Harmony signing payload is malformed: ${label}`);
  }

  const iv = payload.subarray(4, 4 + ivLength);
  const authTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(4 + ivLength, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function resolveHarmonyWorkKey(signingDir, label) {
  const materialDir = path.join(signingDir, 'material');
  const fdDir = path.join(materialDir, 'fd');
  const acDir = path.join(materialDir, 'ac');
  const ceDir = path.join(materialDir, 'ce');
  const fdEntries = listDirectoryEntries(fdDir, `${label} fd`);

  if (fdEntries.length !== 3) {
    throw new Error(
      `Harmony signing material fd must contain exactly three directories: ${fdDir}`,
    );
  }

  const fdComponents = fdEntries.map(entryName =>
    readMaterialFileBytes(path.join(fdDir, entryName), `${label} ${entryName}`),
  );
  const salt = readMaterialFileBytes(acDir, `${label} ac`);
  const encryptedWorkKey = readMaterialFileBytes(ceDir, `${label} ce`);
  const rootKeySeed = xorMaterialComponents(
    [...fdComponents, harmonyMaterialComponent],
    label,
  );
  const rootKey = crypto.pbkdf2Sync(
    rootKeySeed.toString(),
    salt,
    10000,
    16,
    'sha256',
  );

  return decryptHarmonyPayload(rootKey, encryptedWorkKey, label);
}

function encryptHarmonyPayload(key, plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plainText, 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const encryptedSectionLength = encrypted.length + authTag.length;
  const payload = Buffer.alloc(4 + iv.length + encryptedSectionLength);

  payload.writeUInt32BE(encryptedSectionLength, 0);
  iv.copy(payload, 4);
  encrypted.copy(payload, 4 + iv.length);
  authTag.copy(payload, 4 + iv.length + encrypted.length);

  return payload;
}

function encryptHarmonyPassword(plainText, signingDir, label) {
  const key = resolveHarmonyWorkKey(signingDir, label);
  const encryptedPayload = encryptHarmonyPayload(key, plainText);
  const verifiedPlainText = decryptHarmonyPayload(
    key,
    encryptedPayload,
    label,
  ).toString('utf8');

  if (verifiedPlainText !== plainText) {
    throw new Error(`Harmony signing password verification failed: ${label}`);
  }

  return encryptedPayload.toString('hex');
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
  const resolvedSigningDirectory = resolveSigningDirectory(
    configPath,
    signingConfig,
  );
  const certPath = ensureText(signingConfig.certPath)
    ? resolveConfigRelativePath(configPath, signingConfig.certPath, 'signing.certPath')
    : findFirstMatchingFile(resolvedSigningDirectory, ['.cer']);
  const profilePath = ensureText(signingConfig.profilePath)
    ? resolveConfigRelativePath(
        configPath,
        signingConfig.profilePath,
        'signing.profilePath',
      )
    : findFirstMatchingFile(resolvedSigningDirectory, ['.p7b']);
  const storeFilePath = ensureText(signingConfig.storeFilePath)
    ? resolveConfigRelativePath(
        configPath,
        signingConfig.storeFilePath,
        'signing.storeFilePath',
      )
    : findFirstMatchingFile(resolvedSigningDirectory, ['.p12']);

  if (!certPath) {
    throw new Error(
      `Unable to resolve signing.certPath from ${configPath}. Provide signing.certPath explicitly or place a .cer file under signing.directory.`,
    );
  }

  if (!profilePath) {
    const directoryHint = resolvedSigningDirectory
      ? ` No .p7b file was found under ${resolvedSigningDirectory}.`
      : '';
    throw new Error(
      `Unable to resolve signing.profilePath from ${configPath}.${directoryHint} Harmony release signing requires a provisioning profile (.p7b). Export or download it from DevEco Studio / AppGallery Connect, then place it in the signing directory or set signing.profilePath explicitly.`,
    );
  }

  if (!storeFilePath) {
    throw new Error(
      `Unable to resolve signing.storeFilePath from ${configPath}. Provide signing.storeFilePath explicitly or place a .p12 file under signing.directory.`,
    );
  }

  return {
    certPath,
    profilePath,
    signingDir: resolvedSigningDirectory ?? path.dirname(storeFilePath),
    storeFilePath,
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
  const resolvedSigningFiles =
    mode === 'direct'
      ? resolveSigningFilesFromConfig(configPath, resolveDirectSigningConfig(config))
      : restoreSigningArchive(signingArchiveBase64);
  const signingFiles = stageSigningFiles(resolvedSigningFiles);
  const signingLabel = configPath ?? 'HARMONY_RELEASE_CONFIG_JSON_BASE64';
  const encryptedStorePassword = encryptHarmonyPassword(
    ensureText(releaseConfig.storePassword),
    signingFiles.signingDir,
    `${signingLabel}:storePassword`,
  );
  const encryptedKeyPassword = encryptHarmonyPassword(
    ensureText(releaseConfig.keyPassword),
    signingFiles.signingDir,
    `${signingLabel}:keyPassword`,
  );

  if (releaseConfigBase64) {
    process.env.HARMONY_RELEASE_CONFIG_JSON_BASE64 = releaseConfigBase64;
  }

  if (signingArchiveBase64) {
    process.env.HARMONY_SIGNING_ARCHIVE_BASE64 = signingArchiveBase64;
  }

  process.env.HARMONY_APP_BUNDLE_NAME = ensureText(releaseConfig.bundleName);
  process.env.HARMONY_SIGNING_STORE_PASSWORD = encryptedStorePassword;
  process.env.HARMONY_SIGNING_KEY_ALIAS = ensureText(releaseConfig.keyAlias);
  process.env.HARMONY_SIGNING_KEY_PASSWORD = encryptedKeyPassword;
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

export function cleanupLocalHarmonyReleaseArtifacts() {
  if (ensureText(process.env.HARMONY_KEEP_RELEASE_SIGNING_FILES) === '1') {
    return;
  }

  fs.rmSync(signingRootDir, { force: true, recursive: true });
}
