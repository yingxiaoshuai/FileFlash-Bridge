describe('deviceState platform adapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('disables the idle timer on iOS when requested', () => {
    const setIdleTimerDisabled = jest.fn();

    jest.doMock('react-native', () => ({
      NativeModules: {
        FPDeviceState: {
          setIdleTimerDisabled,
        },
      },
      Platform: {
        OS: 'ios',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {setPlatformIdleTimerDisabled} = require('../src/platform/deviceState');

    setPlatformIdleTimerDisabled(true);
    expect(setIdleTimerDisabled).toHaveBeenCalledWith(true);
  });

  test('does nothing outside iOS', () => {
    const setIdleTimerDisabled = jest.fn();

    jest.doMock('react-native', () => ({
      NativeModules: {
        FPDeviceState: {
          setIdleTimerDisabled,
        },
      },
      Platform: {
        OS: 'android',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {setPlatformIdleTimerDisabled} = require('../src/platform/deviceState');

    setPlatformIdleTimerDisabled(true);
    expect(setIdleTimerDisabled).not.toHaveBeenCalled();
  });
});
