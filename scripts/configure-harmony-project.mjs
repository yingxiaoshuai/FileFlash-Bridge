import fs from 'node:fs';
import path from 'node:path';

import JSON5 from 'json5';

const repoRoot = process.cwd();
const harmonyDir = path.join(repoRoot, 'harmony');
const appConfigPath = path.join(harmonyDir, 'AppScope', 'app.json5');
const moduleConfigPath = path.join(
  harmonyDir,
  'entry',
  'src',
  'main',
  'module.json5',
);
const buildProfilePath = path.join(harmonyDir, 'build-profile.json5');

function readJson5(filePath) {
  return JSON5.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson5(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeList(value, fallback) {
  const parsed = String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveSigningConfig() {
  const certPath = process.env.HARMONY_SIGNING_CERT_PATH?.trim();
  const profilePath = process.env.HARMONY_SIGNING_PROFILE_PATH?.trim();
  const storeFilePath = process.env.HARMONY_SIGNING_STORE_FILE_PATH?.trim();
  const storePassword = process.env.HARMONY_SIGNING_STORE_PASSWORD?.trim();
  const keyAlias = process.env.HARMONY_SIGNING_KEY_ALIAS?.trim();
  const keyPassword = process.env.HARMONY_SIGNING_KEY_PASSWORD?.trim();
  const providedValues = [
    certPath,
    profilePath,
    storeFilePath,
    storePassword,
    keyAlias,
    keyPassword,
  ];
  const hasAnySigningValue = providedValues.some(Boolean);
  const hasAllSigningValues = providedValues.every(Boolean);

  if (!hasAnySigningValue) {
    return undefined;
  }

  if (!hasAllSigningValues) {
    throw new Error(
      'Harmony signing environment variables are incomplete. Provide cert, profile, store file, store password, key alias, and key password together.',
    );
  }

  return [
    {
      name: process.env.HARMONY_SIGNING_NAME?.trim() || 'default',
      type: 'HarmonyOS',
      material: {
        certpath: certPath,
        keyAlias,
        keyPassword,
        profile: profilePath,
        signAlg:
          process.env.HARMONY_SIGNING_SIGN_ALG?.trim() || 'SHA256withECDSA',
        storeFile: storeFilePath,
        storePassword,
      },
    },
  ];
}

function main() {
  const appConfig = readJson5(appConfigPath);
  const moduleConfig = readJson5(moduleConfigPath);
  const buildProfile = readJson5(buildProfilePath);
  const nextBundleName = process.env.HARMONY_APP_BUNDLE_NAME?.trim();
  const nextVendor = process.env.HARMONY_APP_VENDOR?.trim();
  const nextVersionName = process.env.HARMONY_APP_VERSION_NAME?.trim();
  const nextVersionCode = parsePositiveInteger(
    process.env.HARMONY_APP_VERSION_CODE,
  );
  const nextDeviceTypes = normalizeList(
    process.env.HARMONY_DEVICE_TYPES,
    ['phone'],
  );
  const nextSigningConfigs = resolveSigningConfig();

  if (nextBundleName) {
    appConfig.app.bundleName = nextBundleName;
  }

  if (nextVendor) {
    appConfig.app.vendor = nextVendor;
  }

  if (nextVersionName) {
    appConfig.app.versionName = nextVersionName;
  }

  if (nextVersionCode) {
    appConfig.app.versionCode = nextVersionCode;
  }

  moduleConfig.module.deviceTypes = nextDeviceTypes;

  if (nextSigningConfigs) {
    buildProfile.app.signingConfigs = nextSigningConfigs;
  }

  writeJson5(appConfigPath, appConfig);
  writeJson5(moduleConfigPath, moduleConfig);
  writeJson5(buildProfilePath, buildProfile);

  const signingMode = nextSigningConfigs ? 'env' : 'existing';
  console.log(
    `[harmony-config] deviceTypes=${nextDeviceTypes.join(', ')} signing=${signingMode}`,
  );
}

main();
