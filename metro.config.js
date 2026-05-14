const {existsSync} = require('node:fs');
const path = require('node:path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const harmonyPackageName = '@react-native-oh/react-native-harmony';
const harmonyPackagePath = path.join(
  __dirname,
  'node_modules',
  '@react-native-oh',
  'react-native-harmony',
);

const readPositiveInteger = value => {
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const isHarmonyBundleCommand =
  process.env.FILEFLASH_HARMONY_BUNDLE === '1' ||
  process.argv.some(arg => /(?:^|[\\/])?bundle-harmony(?:$|\s)/.test(arg));

const maxWorkers =
  readPositiveInteger(process.env.METRO_MAX_WORKERS) ||
  readPositiveInteger(process.env.RCT_METRO_MAX_WORKERS) ||
  (isHarmonyBundleCommand ? 2 : undefined);

const config = {
  ...(maxWorkers ? {maxWorkers} : {}),
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

const baseConfig = getDefaultConfig(__dirname);

if (existsSync(harmonyPackagePath)) {
  const {
    createHarmonyMetroConfig,
  } = require(`${harmonyPackageName}/metro.config`);

  module.exports = mergeConfig(
    baseConfig,
    createHarmonyMetroConfig({
      reactNativeHarmonyPackageName: harmonyPackageName,
    }),
    config,
  );
} else {
  module.exports = mergeConfig(baseConfig, config);
}
