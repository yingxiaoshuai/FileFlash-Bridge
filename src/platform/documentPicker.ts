import {
  createUnsupportedHarmonyFeatureError,
  isHarmonyPlatform,
} from './platform';

export type DocumentPickerConvertibleType = {
  mimeType: string;
};

export type DocumentPickerSelection = {
  convertibleToMimeTypes?: DocumentPickerConvertibleType[];
  copyError?: string;
  fileCopyUri?: string | null;
  isVirtual?: boolean;
  name: string | null;
  size?: number | null;
  type?: string | null;
  uri: string;
};

export type DocumentPickerOptions = {
  allowMultiSelection?: boolean;
  copyTo?: 'cachesDirectory' | 'documentDirectory';
  type?: readonly string[] | string;
};

export type SaveDocumentsOptions = {
  fileName: string;
  mimeType: string;
  sourceUris: string[];
};

export type SaveDocumentsResponse = Array<{
  error?: string;
  uri?: string;
}>;

type NativeDocumentPickerModule = {
  errorCodes: {
    OPERATION_CANCELED: string;
  };
  isErrorWithCode: (error: unknown) => boolean;
  pick: (options?: DocumentPickerOptions) => Promise<DocumentPickerSelection[]>;
  saveDocuments: (
    options: SaveDocumentsOptions,
  ) => Promise<SaveDocumentsResponse>;
  types: Readonly<Record<string, string>>;
};

type HarmonyDocumentPickerModule = {
  isCancel?: (error: unknown) => boolean;
  pick: (options?: DocumentPickerOptions) => Promise<DocumentPickerSelection[]>;
  types: Readonly<Record<string, string>>;
};

const HARMONY_CANCEL_ERROR_CODE = 'DOCUMENT_PICKER_CANCELED';

function requireNativeDocumentPicker(): NativeDocumentPickerModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-documents/picker') as NativeDocumentPickerModule;
}

function requireHarmonyDocumentPicker(): HarmonyDocumentPickerModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require('@react-native-ohos/react-native-document-picker') as
    | HarmonyDocumentPickerModule
    | {default?: HarmonyDocumentPickerModule};

  return (loaded as {default?: HarmonyDocumentPickerModule}).default ??
    (loaded as HarmonyDocumentPickerModule);
}

export const documentPickerErrorCodes = isHarmonyPlatform()
  ? {
      OPERATION_CANCELED: HARMONY_CANCEL_ERROR_CODE,
    }
  : requireNativeDocumentPicker().errorCodes;

export const documentPickerTypes = isHarmonyPlatform()
  ? requireHarmonyDocumentPicker().types
  : requireNativeDocumentPicker().types;

export function isDocumentPickerErrorWithCode(error: unknown) {
  if (isHarmonyPlatform()) {
    const candidate = error as {code?: string; message?: string} | null;
    return (
      candidate?.code === HARMONY_CANCEL_ERROR_CODE ||
      candidate?.message === HARMONY_CANCEL_ERROR_CODE ||
      requireHarmonyDocumentPicker().isCancel?.(error) === true
    );
  }

  return requireNativeDocumentPicker().isErrorWithCode(error);
}

export async function pickDocuments(options?: DocumentPickerOptions) {
  if (isHarmonyPlatform()) {
    return requireHarmonyDocumentPicker().pick(options);
  }

  return requireNativeDocumentPicker().pick(options);
}

export async function savePickedDocuments(options: SaveDocumentsOptions) {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('system document export');
  }

  return requireNativeDocumentPicker().saveDocuments(options);
}
