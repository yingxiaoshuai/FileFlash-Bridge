function loadAdapterForPlatform(platformOs: 'android' | 'ios') {
  jest.resetModules();

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
    const {adapter, read, readChunkBase64, readFile} = loadAdapterForPlatform('ios');
    readChunkBase64.mockResolvedValue('native-chunk-base64');

    await expect(
      adapter.readFileChunkBase64('/tmp/file.bin', 2, 4),
    ).resolves.toBe('native-chunk-base64');

    expect(readChunkBase64).toHaveBeenCalledWith('/tmp/file.bin', 2, 4);
    expect(read).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  test('falls back to full-file slicing for chunk reads on iOS when the native module is unavailable', async () => {
    const {adapter, read, readChunkBase64, readFile} = loadAdapterForPlatform('ios');
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
    const {adapter, read, readChunkBase64, readFile} = loadAdapterForPlatform('ios');
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
});
