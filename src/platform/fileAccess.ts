import {
  cleanupImportedDeviceFiles,
  consumePendingSharedItems,
  createReactNativeInboundStorageGateway,
  exportPreparedFile,
  exportStoredFile,
  pickDeviceFilesForShare,
  pickDeviceMediaForShare,
} from '../modules/file-access/reactNativeAdapters';

import {
  createUnsupportedHarmonyFeatureError,
  isHarmonyPlatform,
} from './platform';

export {
  cleanupImportedDeviceFiles,
  consumePendingSharedItems,
  exportPreparedFile,
  exportStoredFile,
};

export type {
  ExportResult,
  ImportedDeviceFile,
  ImportedDeviceText,
  PendingSharedItems,
} from '../modules/file-access/reactNativeAdapters';

export function createPlatformInboundStorageGateway(sessionId?: string) {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('local file storage');
  }

  return createReactNativeInboundStorageGateway(sessionId);
}

export async function pickPlatformFilesForShare() {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('document import');
  }

  return pickDeviceFilesForShare();
}

export async function pickPlatformMediaForShare() {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('media import');
  }

  return pickDeviceMediaForShare();
}
