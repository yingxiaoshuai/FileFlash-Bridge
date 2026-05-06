import {createUnsupportedHarmonyFeatureError} from './platform';

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

type HarmonyDocumentPickerModule = {
  isCancel?: (error: unknown) => boolean;
  pick: (options?: DocumentPickerOptions) => Promise<DocumentPickerSelection[]>;
  types: Readonly<Record<string, string>>;
};

const HARMONY_CANCEL_ERROR_CODE = 'DOCUMENT_PICKER_CANCELED';

function requireHarmonyDocumentPicker(): HarmonyDocumentPickerModule {
  const loaded = require('@react-native-ohos/react-native-document-picker') as
    | HarmonyDocumentPickerModule
    | {default?: HarmonyDocumentPickerModule};

  return (loaded as {default?: HarmonyDocumentPickerModule}).default ??
    (loaded as HarmonyDocumentPickerModule);
}

export const documentPickerErrorCodes = {
  OPERATION_CANCELED: HARMONY_CANCEL_ERROR_CODE,
};

export const documentPickerTypes = requireHarmonyDocumentPicker().types;

export function isDocumentPickerErrorWithCode(error: unknown) {
  const candidate = error as {code?: string; message?: string} | null;
  return (
    candidate?.code === HARMONY_CANCEL_ERROR_CODE ||
    candidate?.message === HARMONY_CANCEL_ERROR_CODE ||
    requireHarmonyDocumentPicker().isCancel?.(error) === true
  );
}

export async function pickDocuments(options?: DocumentPickerOptions) {
  return requireHarmonyDocumentPicker().pick(options);
}

export async function savePickedDocuments(_options: SaveDocumentsOptions) {
  throw createUnsupportedHarmonyFeatureError('system document export');
}
