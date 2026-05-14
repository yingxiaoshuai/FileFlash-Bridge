describe('Harmony platform adapters', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('uses the file picker as a media-import fallback on Harmony', async () => {
    const pickDeviceFilesForShare = jest.fn().mockResolvedValue([{id: 'file'}]);
    const pickDeviceMediaForShare = jest.fn();

    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('../src/modules/file-access/reactNativeAdapters', () => ({
      cleanupImportedDeviceFiles: jest.fn(),
      consumePendingSharedItems: jest.fn(),
      createReactNativeInboundStorageGateway: jest.fn(),
      exportPreparedFile: jest.fn(),
      exportStoredFile: jest.fn(),
      pickDeviceFilesForShare,
      pickDeviceMediaForShare,
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {pickPlatformMediaForShare} = require('../src/platform/fileAccess');

    await expect(pickPlatformMediaForShare()).resolves.toEqual([{id: 'file'}]);
    expect(pickDeviceFilesForShare).toHaveBeenCalledTimes(1);
    expect(pickDeviceMediaForShare).not.toHaveBeenCalled();
  });

  test('selects the native HTTP runtime on Harmony so LAN URLs use the device IP', () => {
    const harmonyRuntime = {
      isRunning: jest.fn(),
      start: jest.fn(),
    };
    const createReactNativeTcpHttpRuntime = jest.fn();
    const createReactNativeHttpRuntime = jest.fn(() => harmonyRuntime);

    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('../src/modules/service/reactNativeTcpHttpRuntime', () => ({
      createReactNativeTcpHttpRuntime,
    }));
    jest.doMock('../src/modules/service/reactNativeHttpRuntime', () => ({
      createReactNativeHttpRuntime,
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {createPlatformServiceRuntime} = require('../src/platform/serviceRuntime.harmony');

    expect(createPlatformServiceRuntime()).toBe(harmonyRuntime);
    expect(createReactNativeHttpRuntime).toHaveBeenCalledTimes(1);
    expect(createReactNativeTcpHttpRuntime).not.toHaveBeenCalled();
  });

  test('writes to the clipboard on Harmony without throwing', () => {
    const setString = jest.fn();

    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'harmony',
      },
    }));
    jest.doMock('@react-native-clipboard/clipboard', () => ({
      setString,
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {setClipboardString} = require('../src/platform/clipboard');

    expect(() => setClipboardString('hello harmony')).not.toThrow();
    expect(setString).toHaveBeenCalledWith('hello harmony');
  });
});
