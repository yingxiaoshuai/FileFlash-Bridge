import {
  cleanupImportedDeviceFiles,
  consumePendingSharedItems,
  createReactNativeInboundStorageGateway,
  exportPreparedFile,
  exportPreparedFiles,
  exportStoredFile,
  pickDeviceFilesForShare,
  pickDeviceMediaForShare,
} from '../modules/file-access/reactNativeAdapters';

import { isHarmonyPlatform } from './platform';

export {
  cleanupImportedDeviceFiles,
  consumePendingSharedItems,
  exportPreparedFile,
  exportPreparedFiles,
  exportStoredFile,
};

export type {
  ExportFileSource,
  ExportResult,
  ImportedDeviceFile,
  ImportedDeviceText,
  PendingSharedItems,
} from '../modules/file-access/reactNativeAdapters';

export function createPlatformInboundStorageGateway(sessionId?: string) {
  return createReactNativeInboundStorageGateway(sessionId);
}

export async function pickPlatformFilesForShare() {
  return pickDeviceFilesForShare();
}

export async function pickPlatformMediaForShare() {
  return isHarmonyPlatform()
    ? pickDeviceFilesForShare()
    : pickDeviceMediaForShare();
}
