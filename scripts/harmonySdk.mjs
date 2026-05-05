import fs from 'node:fs';

function getCandidateSdkPaths() {
  if (process.platform === 'win32') {
    return [
      'E:\\DevEco Studio\\sdk',
      'D:\\DevEco Studio\\sdk',
      'C:\\DevEco Studio\\sdk',
      'C:\\Program Files\\Huawei\\DevEco Studio\\sdk',
      'C:\\Program Files\\DevEco Studio\\sdk',
    ];
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/DevEco-Studio.app/Contents/sdk',
      '/Applications/DevEco Studio.app/Contents/sdk',
    ];
  }

  return [];
}

export function resolveDevEcoSdkHome() {
  const fromEnv = process.env.DEVECO_SDK_HOME?.trim();

  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  for (const candidatePath of getCandidateSdkPaths()) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export function ensureDevEcoSdkHome() {
  const resolvedPath = resolveDevEcoSdkHome();

  if (resolvedPath) {
    process.env.DEVECO_SDK_HOME = resolvedPath;
  }

  return resolvedPath;
}
