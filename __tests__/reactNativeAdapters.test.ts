function loadAdapterForPlatform(platformOs: 'android' | 'harmony' | 'ios') {
  jest.resetModules();

  const appendFile = jest.fn();
  const appendFileFromPath = jest.fn();
  const copyFile = jest.fn();
  const exists = jest.fn();
  const mkdir = jest.fn();
  const read = jest.fn();
  const readFileChunk = jest.fn();
  const readFile = jest.fn();
  const saveFileToDocuments = jest.fn();
  const stat = jest.fn();
  const writeFile = jest.fn();

  jest.doMock('react-native', () => ({
    NativeModules: {
      FPFileAccess:
        platformOs === 'harmony'
          ? {
              appendFile,
              appendFileFromPath,
              copyFile,
              readFile,
              readFileChunk,
              saveFileToDocuments,
              writeFile,
            }
          : undefined,
    },
    Platform: {
      OS: platformOs,
    },
  }));

  jest.doMock('@react-native-documents/picker', () => ({
    errorCodes: {},
    isErrorWithCode: jest.fn(),
    keepLocalCopy: jest.fn(),
    pick: jest.fn(),
    saveDocuments: jest.fn(),
    types: {},
  }));

  jest.doMock('react-native-share', () => ({
    __esModule: true,
    default: {},
  }));

  jest.doMock('react-native-fs', () => ({
    __esModule: true,
    default: {
      appendFile,
      copyFile,
      exists,
      mkdir,
      read,
      readFile,
      stat,
      writeFile,
    },
  }));

  jest.doMock('pako', () => ({
    gzip: jest.fn(),
    ungzip: jest.fn(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const reactNativeAdapters = require('../src/modules/file-access/reactNativeAdapters');

  return {
    adapter: new reactNativeAdapters.ReactNativeFileSystemAdapter(),
    appendFile,
    appendFileFromPath,
    copyFile,
    exists,
    exportStoredFile: reactNativeAdapters.exportStoredFile,
    mkdir,
    read,
    readFileChunk,
    readFile,
    saveFileToDocuments,
    stat,
    writeFile,
  };
}

describe('ReactNativeFileSystemAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('does not crash on Harmony startup when FPFileAccess is missing', async () => {
    jest.resetModules();

    jest.doMock('react-native', () => ({
      NativeModules: new Proxy(
        {},
        {
          get(_target, property) {
            if (property === 'FPFileAccess') {
              throw new Error(
                "Couldn't find Turbo Module on the ArkTS side, name: 'FPFileAccess'",
              );
            }

            return undefined;
          },
        },
      ),
      Platform: {
        OS: 'harmony',
      },
      TurboModuleRegistry: {
        get: jest.fn(() => null),
      },
    }));
    jest.doMock('../src/platform/documentPicker', () => ({
      documentPickerErrorCodes: {
        OPERATION_CANCELED: 'DOCUMENT_PICKER_CANCELED',
      },
      documentPickerTypes: {
        allFiles: '*/*',
      },
      isDocumentPickerErrorWithCode: jest.fn(),
      pickDocuments: jest.fn(),
      savePickedDocuments: jest.fn(),
    }));
    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {},
    }));
    jest.doMock('react-native-fs', () => ({
      __esModule: true,
      default: {
        DocumentDirectoryPath: '/sandbox/files',
        mkdir: jest.fn(),
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      ReactNativeFileSystemAdapter,
    } = require('../src/modules/file-access/reactNativeAdapters');
    const adapter = new ReactNativeFileSystemAdapter();

    await expect(adapter.readFile('/tmp/file.bin')).rejects.toThrow(
      /FPFileAccess/,
    );
  });

  test('retries Harmony FPFileAccess lookup after startup', async () => {
    jest.resetModules();

    const nativeModules: Record<string, unknown> = {};
    const mkdir = jest.fn().mockResolvedValue(undefined);
    const writeFile = jest.fn().mockResolvedValue(undefined);

    jest.doMock('react-native', () => ({
      NativeModules: nativeModules,
      Platform: {
        OS: 'harmony',
      },
      TurboModuleRegistry: {
        get: jest.fn((name: string) =>
          name === 'FPFileAccess'
            ? (nativeModules.FPFileAccess as unknown)
            : null,
        ),
      },
    }));
    jest.doMock('../src/platform/documentPicker', () => ({
      documentPickerErrorCodes: {
        OPERATION_CANCELED: 'DOCUMENT_PICKER_CANCELED',
      },
      documentPickerTypes: {
        allFiles: '*/*',
      },
      isDocumentPickerErrorWithCode: jest.fn(),
      pickDocuments: jest.fn(),
      savePickedDocuments: jest.fn(),
    }));
    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {},
    }));
    jest.doMock('react-native-fs', () => ({
      __esModule: true,
      default: {
        DocumentDirectoryPath: '/sandbox/files',
        mkdir,
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      ReactNativeFileSystemAdapter,
    } = require('../src/modules/file-access/reactNativeAdapters');
    const adapter = new ReactNativeFileSystemAdapter();
    const bytes = Uint8Array.from([1, 2, 3]);

    nativeModules.FPFileAccess = {
      writeFile,
    };

    await expect(adapter.writeFile('/tmp/file.bin', bytes)).resolves.toBeUndefined();
    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(writeFile).toHaveBeenCalledWith('/tmp/file.bin', [1, 2, 3]);
  });

  test('uses native byte chunk reads on Harmony when the module is available', async () => {
    const { adapter, read, readFile, readFileChunk } =
      loadAdapterForPlatform('harmony');
    readFileChunk.mockResolvedValue(Uint8Array.from([2, 3, 4, 5]));

    await expect(adapter.readFileChunk('/tmp/file.bin', 2, 4)).resolves.toEqual(
      Uint8Array.from([2, 3, 4, 5]),
    );

    expect(readFileChunk).toHaveBeenCalledWith('/tmp/file.bin', 2, 4);
    expect(read).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  test('uses RNFS byte chunk reads on Android', async () => {
    const { adapter, read, readFile } = loadAdapterForPlatform('android');
    const chunkBytes = Buffer.from('chunk-data', 'utf8');
    read.mockResolvedValue(chunkBytes.toString('base64'));

    await expect(
      adapter.readFileChunk('/tmp/file.bin', 16, 32),
    ).resolves.toEqual(new Uint8Array(chunkBytes));

    expect(read).toHaveBeenCalledWith('/tmp/file.bin', 32, 16, 'base64');
    expect(readFile).not.toHaveBeenCalled();
  });

  test('passes Harmony appends to native byte file access', async () => {
    const { adapter, appendFile, mkdir } = loadAdapterForPlatform('harmony');
    appendFile.mockResolvedValue(undefined);

    const content = new Uint8Array(300 * 1024);
    content.fill(7);

    await expect(
      adapter.appendFile('/tmp/upload.part', content),
    ).resolves.toBeUndefined();

    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(appendFile).toHaveBeenCalledTimes(1);
    expect(appendFile).toHaveBeenCalledWith(
      '/tmp/upload.part',
      Array.from(content),
    );
  });

  test('passes Harmony path appends to native file access without JS bytes', async () => {
    const { adapter, appendFileFromPath, mkdir } = loadAdapterForPlatform('harmony');
    appendFileFromPath.mockResolvedValue(undefined);

    await expect(
      adapter.appendFileFromPath('/tmp/upload.part', '/cache/request.part'),
    ).resolves.toBeUndefined();

    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(appendFileFromPath).toHaveBeenCalledWith(
      '/tmp/upload.part',
      '/cache/request.part',
    );
  });

  test('saves Harmony stored files through native document picker copy', async () => {
    const { exportStoredFile, saveFileToDocuments } =
      loadAdapterForPlatform('harmony');
    saveFileToDocuments.mockResolvedValue('file://documents/scene.glb');

    await expect(
      exportStoredFile({
        compression: 'none',
        createdAt: '2026-05-12T00:00:00.000Z',
        displayName: 'scene.glb',
        id: 'file-scene',
        isLargeFile: true,
        mimeType: 'model/gltf-binary',
        originalSize: 512 * 1024 * 1024,
        projectId: 'project-a',
        relativePath: 'scene.glb',
        size: 512 * 1024 * 1024,
        storagePath: '/app/files/scene.glb',
        storedSize: 512 * 1024 * 1024,
      }),
    ).resolves.toEqual({
      destinationUri: 'file://documents/scene.glb',
      method: 'harmony-files',
    });

    expect(saveFileToDocuments).toHaveBeenCalledWith(
      '/app/files/scene.glb',
      'scene.glb',
    );
  });

  test('fails iOS copy when native copy leaves it missing', async () => {
    const { adapter, copyFile, exists, mkdir, readFile, stat, writeFile } =
      loadAdapterForPlatform('ios');
    copyFile.mockResolvedValue(undefined);
    exists.mockResolvedValue(false);
    readFile.mockResolvedValue(
      Buffer.from('image-bytes', 'utf8').toString('base64'),
    );
    stat.mockResolvedValueOnce({ size: 11 });

    await expect(
      adapter.copyFile('/tmp/source.png', '/tmp/destination.png'),
    ).rejects.toThrow(/Native file copy failed/);

    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(copyFile).toHaveBeenCalledWith(
      '/tmp/source.png',
      '/tmp/destination.png',
    );
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('reads pending shared items from the Harmony inbox manifest when the native bridge is unavailable', async () => {
    jest.resetModules();

    const exists = jest.fn().mockResolvedValue(true);
    const readFile = jest.fn().mockResolvedValue(
      JSON.stringify({
        files: [
          {
            byteLength: 12,
            createdAt: '2026-04-29T12:00:00.000Z',
            mimeType: 'text/plain',
            name: 'notes.txt',
            relativePath: 'notes.txt',
            sourcePath: '/sandbox/cache/ffb-inbound/notes.txt',
          },
        ],
        texts: [
          {
            content: 'Shared note',
            createdAt: '2026-04-29T12:00:00.000Z',
          },
        ],
      }),
    );
    const unlink = jest.fn().mockResolvedValue(undefined);

    jest.doMock('react-native', () => ({
      NativeModules: {},
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('../src/platform/documentPicker', () => ({
      documentPickerErrorCodes: {
        OPERATION_CANCELED: 'DOCUMENT_PICKER_CANCELED',
      },
      documentPickerTypes: {
        allFiles: '*/*',
      },
      isDocumentPickerErrorWithCode: jest.fn(),
      pickDocuments: jest.fn(),
      savePickedDocuments: jest.fn(),
    }));
    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {},
    }));
    jest.doMock('react-native-fs', () => ({
      __esModule: true,
      default: {
        DocumentDirectoryPath: '/sandbox/files',
        exists,
        mkdir: jest.fn(),
        readFile,
        unlink,
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      consumePendingSharedItems,
    } = require('../src/modules/file-access/reactNativeAdapters');

    await expect(consumePendingSharedItems()).resolves.toEqual({
      files: [
        {
          byteLength: 12,
          cleanupPath: '/sandbox/cache/ffb-inbound/notes.txt',
          createdAt: '2026-04-29T12:00:00.000Z',
          mimeType: 'text/plain',
          name: 'notes.txt',
          relativePath: 'notes.txt',
          sourcePath: '/sandbox/cache/ffb-inbound/notes.txt',
        },
      ],
      texts: [
        {
          content: 'Shared note',
          createdAt: '2026-04-29T12:00:00.000Z',
        },
      ],
    });

    expect(exists).toHaveBeenCalledWith(
      '/sandbox/files/ffb-inbound/pending.json',
    );
    expect(readFile).toHaveBeenCalledWith(
      '/sandbox/files/ffb-inbound/pending.json',
      'utf8',
    );
    expect(unlink).toHaveBeenCalledWith(
      '/sandbox/files/ffb-inbound/pending.json',
    );
  });

  test('reports Harmony shared item capture failures from the inbox manifest', async () => {
    jest.resetModules();

    const exists = jest.fn().mockResolvedValue(true);
    const readFile = jest.fn().mockResolvedValue(
      JSON.stringify({
        error: '共享文件导入失败：共享文件无法读取，请重新选择文件。',
      }),
    );
    const unlink = jest.fn().mockResolvedValue(undefined);

    jest.doMock('react-native', () => ({
      NativeModules: {},
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('../src/platform/documentPicker', () => ({
      documentPickerErrorCodes: {
        OPERATION_CANCELED: 'DOCUMENT_PICKER_CANCELED',
      },
      documentPickerTypes: {
        allFiles: '*/*',
      },
      isDocumentPickerErrorWithCode: jest.fn(),
      pickDocuments: jest.fn(),
      savePickedDocuments: jest.fn(),
    }));
    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {},
    }));
    jest.doMock('react-native-fs', () => ({
      __esModule: true,
      default: {
        DocumentDirectoryPath: '/sandbox/files',
        exists,
        mkdir: jest.fn(),
        readFile,
        unlink,
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      consumePendingSharedItems,
    } = require('../src/modules/file-access/reactNativeAdapters');

    await expect(consumePendingSharedItems()).rejects.toThrow(
      /共享文件导入失败/,
    );
    expect(unlink).toHaveBeenCalledWith(
      '/sandbox/files/ffb-inbound/pending.json',
    );
  });

  test('uses the original Harmony picker uri without forcing a cache copy', async () => {
    jest.resetModules();

    const pickDocuments = jest.fn().mockResolvedValue([
      {
        fileCopyUri: null,
        name: 'picked.txt',
        size: 12,
        type: 'text/plain',
        uri: '/user/docs/picked.txt',
      },
    ]);
    const stat = jest.fn().mockRejectedValue(new Error('stat unavailable'));

    jest.doMock('react-native', () => ({
      NativeModules: {},
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('../src/platform/documentPicker', () => ({
      documentPickerErrorCodes: {
        OPERATION_CANCELED: 'DOCUMENT_PICKER_CANCELED',
      },
      documentPickerTypes: {
        allFiles: '*/*',
      },
      isDocumentPickerErrorWithCode: jest.fn(),
      pickDocuments,
      savePickedDocuments: jest.fn(),
    }));
    jest.doMock('react-native-share', () => ({
      __esModule: true,
      default: {},
    }));
    jest.doMock('react-native-fs', () => ({
      __esModule: true,
      default: {
        DocumentDirectoryPath: '/sandbox/files',
        exists: jest.fn(),
        mkdir: jest.fn(),
        readFile: jest.fn(),
        stat,
        unlink: jest.fn(),
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      pickDeviceFilesForShare,
    } = require('../src/modules/file-access/reactNativeAdapters');

    await expect(pickDeviceFilesForShare()).resolves.toEqual([
      {
        byteLength: 12,
        cleanupPath: undefined,
        mimeType: 'text/plain',
        name: 'picked.txt',
        relativePath: 'picked.txt',
        sourcePath: '/user/docs/picked.txt',
      },
    ]);

    expect(pickDocuments).toHaveBeenCalledWith({
      allowMultiSelection: true,
      type: ['*/*'],
    });
    expect(stat).toHaveBeenCalledWith('/user/docs/picked.txt');
  });
});
