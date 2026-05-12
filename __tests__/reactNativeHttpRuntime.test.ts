describe('ReactNativeHttpRuntime', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('passes Harmony bodyBytes to the shared handler as Uint8Array', async () => {
    const start = jest.fn().mockResolvedValue('http://127.0.0.1:8668');
    const stop = jest.fn();
    const isRunning = jest.fn().mockResolvedValue(true);
    const respond = jest.fn();

    jest.doMock('react-native', () => {
      const listeners = new Map<string, (payload: unknown) => void>();

      return {
        DeviceEventEmitter: {
          emit: (eventName: string, payload: unknown) => {
            listeners.get(eventName)?.(payload);
          },
        },
        NativeEventEmitter: jest.fn().mockImplementation(() => ({
          addListener: (eventName: string, listener: (payload: unknown) => void) => {
            listeners.set(eventName, listener);
            return {
              remove: () => listeners.delete(eventName),
            };
          },
        })),
        NativeModules: {
          FPStaticServer: {
            addListener: jest.fn(),
            isRunning,
            removeListeners: jest.fn(),
            respond,
            start,
            stop,
          },
        },
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {createReactNativeHttpRuntime} = require('../src/modules/service/reactNativeHttpRuntime');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {DeviceEventEmitter: mockedDeviceEventEmitter} = require('react-native');

    const runtime = createReactNativeHttpRuntime();
    const handler = jest.fn().mockResolvedValue({
      body: {ok: true},
      headers: {'content-type': 'application/json; charset=utf-8'},
      status: 200,
    });

    await runtime.start({
      handler,
      port: 8668,
    });

    const bodyBytes = new Uint8Array([1, 2, 3, 4, 5]);
    mockedDeviceEventEmitter.emit('fpStaticServerRequest', {
      bodyBytes,
      headers: {
        'content-length': '5',
        'content-type': 'application/octet-stream',
      },
      method: 'POST',
      path: '/api/upload/part',
      query: {
        uploadId: 'upload-1',
      },
      requestId: 'request-1',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].body).toBeInstanceOf(Uint8Array);
    expect(Array.from(handler.mock.calls[0][0].body)).toEqual([1, 2, 3, 4, 5]);
    expect(respond).toHaveBeenCalledWith(
      'request-1',
      200,
      {'content-type': 'application/json; charset=utf-8'},
      'text',
      JSON.stringify({ok: true}),
    );
  });
});
