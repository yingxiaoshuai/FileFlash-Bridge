import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const androidDir = path.join(repoRoot, 'android');
const apkOutputDir = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
);
const stagedApkDir = path.join(
  os.tmpdir(),
  'fileflash-bridge-android-release-apks',
);

const args = new Set(process.argv.slice(2));
const buildApks = !args.has('--aab-only');
const buildAab = args.has('--with-aab') || args.has('--aab-only');

const apkTargets = [
  {
    abi: 'armeabi-v7a',
    label: '32-bit',
    outputFileName: 'app-armeabi-v7a-release.apk',
  },
  {
    abi: 'arm64-v8a',
    label: '64-bit',
    outputFileName: 'app-arm64-v8a-release.apk',
  },
];

const runGradle = gradleArgs => {
  const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const result = spawnSync(command, gradleArgs, {
    cwd: androidDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const removeIfExists = filePath => {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, {recursive: true, force: true});
  }
};

const moveFile = (sourcePath, destinationPath) => {
  fs.copyFileSync(sourcePath, destinationPath);
  fs.rmSync(sourcePath, {force: true});
};

const releaseApkPath = path.join(apkOutputDir, 'app-release.apk');

for (const target of apkTargets) {
  removeIfExists(path.join(apkOutputDir, target.outputFileName));
}
removeIfExists(stagedApkDir);
fs.mkdirSync(stagedApkDir, {recursive: true});

runGradle(['clean']);

if (buildApks) {
  for (const target of apkTargets) {
    console.log(`\nBuilding ${target.label} APK (${target.abi})...`);
    runGradle(['assembleRelease', `-PreactNativeArchitectures=${target.abi}`]);

    if (!fs.existsSync(releaseApkPath)) {
      console.error(`Expected release APK at ${releaseApkPath}, but it was not created.`);
      process.exit(1);
    }

    moveFile(
      releaseApkPath,
      path.join(stagedApkDir, target.outputFileName),
    );
  }
}

if (buildAab) {
  console.log('\nBuilding Android App Bundle (AAB)...');
  runGradle([
    'bundleRelease',
    '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a',
  ]);
}

if (buildApks) {
  for (const target of apkTargets) {
    fs.copyFileSync(
      path.join(stagedApkDir, target.outputFileName),
      path.join(apkOutputDir, target.outputFileName),
    );
  }
}
