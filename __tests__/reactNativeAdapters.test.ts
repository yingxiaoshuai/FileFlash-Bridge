function loadAdapterForPlatform(platformOs: 'android' | 'harmony' | 'ios') {
  jest.resetModules();

  const appendFile = jest.fn();
  const copyFile = jest.fn();
  const exists = jest.fn();
  const mkdir = jest.fn();
  const read = jest.fn();
  const readChunkBase64 = jest.fn();
  const readFile = jest.fn();
  const stat = jest.fn();
  const writeFile = jest.fn();

  jest.doMock('react-native', () => ({
    NativeModules: {
      FPFileReader:
        platformOs === 'ios'
          ? {
              readChunkBase64,
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
  const {ReactNativeFileSystemAdapter} = require('../src/modules/file-access/reactNativeAdapters');

  return {
    adapter: new ReactNativeFileSystemAdapter(),
    appendFile,
    copyFile,
    exists,
    mkdir,
    read,
    readChunkBase64,
    readFile,
    stat,
    writeFile,
  };
}

describe('ReactNativeFileSystemAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('uses native chunk reads on iOS when the module is available', async () => {
    const {adapter, read, readChunkBase64, readFile} =
      loadAdapterForPlatform('ios');
    readChunkBase64.mockResolvedValue('native-chunk-base64');

    await expect(
      adapter.readFileChunkBase64('/tmp/file.bin', 2, 4),
    ).resolves.toBe('native-chunk-base64');

    expect(readChunkBase64).toHaveBeenCalledWith('/tmp/file.bin', 2, 4);
    expect(read).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  test('falls back to full-file slicing for chunk reads on iOS when the native module is unavailable', async () => {
    const {read, readChunkBase64, readFile} = loadAdapterForPlatform('ios');
    readChunkBase64.mockReset();
    // Simulate the JS bundle running before the native module is compiled in.
    jest.resetModules();
    jest.doMock('react-native', () => ({
      NativeModules: {},
      Platform: {
        OS: 'ios',
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
        copyFile: jest.fn(),
        exists: jest.fn(),
        mkdir: jest.fn(),
        read: jest.fn(),
        readFile,
        stat: jest.fn(),
        writeFile: jest.fn(),
      },
    }));
    jest.doMock('pako', () => ({
      gzip: jest.fn(),
      ungzip: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {ReactNativeFileSystemAdapter} = require('../src/modules/file-access/reactNativeAdapters');
    const fallbackAdapter = new ReactNativeFileSystemAdapter();
    readFile.mockResolvedValue(Buffer.from('0123456789', 'utf8').toString('base64'));

    const chunkBase64 = await fallbackAdapter.readFileChunkBase64('/tmp/file.bin', 2, 4);

    expect(Buffer.from(chunkBase64, 'base64').toString('utf8')).toBe('2345');
    expect(read).not.toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledWith('/tmp/file.bin', 'base64');
  });

  test('falls back to a JS chunk read on iOS when the native reader rejects', async () => {
    const {adapter, read, readChunkBase64, readFile} =
      loadAdapterForPlatform('ios');
    readChunkBase64.mockRejectedValue(new Error('native read failed'));
    readFile.mockResolvedValue(Buffer.from('abcdefghij', 'utf8').toString('base64'));

    const chunkBase64 = await adapter.readFileChunkBase64('/tmp/file.bin', 3, 4);

    expect(Buffer.from(chunkBase64, 'base64').toString('utf8')).toBe('defg');
    expect(readChunkBase64).toHaveBeenCalledWith('/tmp/file.bin', 3, 4);
    expect(read).not.toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledWith('/tmp/file.bin', 'base64');
  });

  test('keeps using native chunk reads on Android', async () => {
    const {adapter, read, readFile} = loadAdapterForPlatform('android');
    read.mockResolvedValue('chunk-base64');

    await expect(
      adapter.readFileChunkBase64('/tmp/file.bin', 16, 32),
    ).resolves.toBe('chunk-base64');

    expect(read).toHaveBeenCalledWith('/tmp/file.bin', 32, 16, 'base64');
    expect(readFile).not.toHaveBeenCalled();
  });

  test('splits large Harmony appends into small base64 file writes', async () => {
    const {adapter, appendFile, mkdir} = loadAdapterForPlatform('harmony');
    appendFile.mockResolvedValue(undefined);

    const content = new Uint8Array(300 * 1024);
    content.fill(7);

    await expect(adapter.appendFile('/tmp/upload.part', content)).resolves.toBeUndefined();

    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(appendFile.mock.calls.length).toBeGreaterThan(1);
    expect(
      appendFile.mock.calls.every(
        ([path, _contentBase64, encoding]) =>
          path === '/tmp/upload.part' && encoding === 'base64',
      ),
    ).toBe(true);

    const writtenByteLength = appendFile.mock.calls.reduce(
      (sum, [_path, contentBase64]) =>
        sum + Buffer.from(String(contentBase64), 'base64').byteLength,
      0,
    );
    expect(writtenByteLength).toBe(content.byteLength);
  });

  test('rebuilds the destination file on iOS when native copy leaves it missing', async () => {
    const {adapter, copyFile, exists, mkdir, readFile, stat, writeFile} =
      loadAdapterForPlatform('ios');
    copyFile.mockResolvedValue(undefined);
    exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    readFile.mockResolvedValue(Buffer.from('image-bytes', 'utf8').toString('base64'));
    stat.mockResolvedValueOnce({size: 11}).mockResolvedValueOnce({size: 11});

    await expect(
      adapter.copyFile('/tmp/source.png', '/tmp/destination.png'),
    ).resolves.toBeUndefined();

    expect(mkdir).toHaveBeenCalledWith('/tmp');
    expect(copyFile).toHaveBeenCalledWith('/tmp/source.png', '/tmp/destination.png');
    expect(readFile).toHaveBeenCalledWith('/tmp/source.png', 'base64');
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/destination.png',
      Buffer.from('image-bytes', 'utf8').toString('base64'),
      'base64',
    );
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
    const {consumePendingSharedItems} = require('../src/modules/file-access/reactNativeAdapters');

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

    expect(exists).toHaveBeenCalledWith('/sandbox/files/ffb-inbound/pending.json');
    expect(readFile).toHaveBeenCalledWith(
      '/sandbox/files/ffb-inbound/pending.json',
      'utf8',
    );
    expect(unlink).toHaveBeenCalledWith('/sandbox/files/ffb-inbound/pending.json');
  });

  test('uses the original Harmony picker uri when a cache copy is unavailable', async () => {
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
    const {pickDeviceFilesForShare} = require('../src/modules/file-access/reactNativeAdapters');

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
      copyTo: 'cachesDirectory',
      type: ['*/*'],
    });
    expect(stat).toHaveBeenCalledWith('/user/docs/picked.txt');
  });
});
