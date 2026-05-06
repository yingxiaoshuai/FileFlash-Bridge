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

function requireNativeDocumentPicker(): NativeDocumentPickerModule {
  return require('@react-native-documents/picker') as NativeDocumentPickerModule;
}

export const documentPickerErrorCodes = requireNativeDocumentPicker().errorCodes;

export const documentPickerTypes = requireNativeDocumentPicker().types;

export function isDocumentPickerErrorWithCode(error: unknown) {
  return requireNativeDocumentPicker().isErrorWithCode(error);
}

export async function pickDocuments(options?: DocumentPickerOptions) {
  return requireNativeDocumentPicker().pick(options);
}

export async function savePickedDocuments(options: SaveDocumentsOptions) {
  return requireNativeDocumentPicker().saveDocuments(options);
}
