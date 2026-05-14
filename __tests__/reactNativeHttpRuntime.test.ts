describe('ReactNativeHttpRuntime', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('normalizes Harmony upload bodyBytes into Uint8Array', async () => {
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

    const bodyBytes = {
      0: 1,
      1: 2,
      2: 3,
      3: 4,
      4: 5,
      length: 5,
    };
    mockedDeviceEventEmitter.emit('fpStaticServerRequest', {
      bodyBytes,
      headers: {
        'content-length': '5',
        'content-type': 'application/json',
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

  test('preserves upload bodyText as UTF-8 bytes for JSON files', async () => {
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

    const bodyText = '{"name":"总装-1","items":[1,2,3]}';
    mockedDeviceEventEmitter.emit('fpStaticServerRequest', {
      bodyText,
      headers: {
        'content-length': String(new TextEncoder().encode(bodyText).byteLength),
        'content-type': 'application/json',
      },
      method: 'POST',
      path: '/api/upload',
      query: {
        name: '总装-1.json',
        relativePath: '总装-1.json',
      },
      requestId: 'request-json-upload',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].body).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(handler.mock.calls[0][0].body).toString('utf8')).toBe(
      bodyText,
    );
  });

  test('forwards Harmony upload temp file metadata without reading it through JS', async () => {
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

    mockedDeviceEventEmitter.emit('fpStaticServerRequest', {
      bodyFile: {
        byteLength: 5 * 1024 * 1024,
        path: '/cache/fileflash-http-upload/request.part',
      },
      headers: {
        'content-length': String(5 * 1024 * 1024),
        'content-type': 'application/octet-stream',
      },
      method: 'POST',
      path: '/api/upload/part',
      query: {
        offset: '0',
        uploadId: 'upload-large',
      },
      requestId: 'request-large-upload',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].body).toBeUndefined();
    expect(handler.mock.calls[0][0].bodyFile).toEqual({
      byteLength: 5 * 1024 * 1024,
      path: '/cache/fileflash-http-upload/request.part',
    });
  });

  test('responds with Harmony file response metadata without sending bytes through JS', async () => {
    const start = jest.fn().mockResolvedValue('http://127.0.0.1:8668');
    const stop = jest.fn();
    const isRunning = jest.fn().mockResolvedValue(true);
    const respond = jest.fn();
    const respondFile = jest.fn();

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
            respondFile,
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
      bodyFile: {
        length: 5 * 1024 * 1024,
        offset: 0,
        path: '/data/storage/file.bin',
      },
      headers: {
        'content-length': String(5 * 1024 * 1024),
        'content-type': 'application/octet-stream',
      },
      status: 206,
    });

    expect(runtime.supportsFileResponses).toBe(true);

    await runtime.start({
      handler,
      port: 8668,
    });

    mockedDeviceEventEmitter.emit('fpStaticServerRequest', {
      headers: {},
      method: 'GET',
      path: '/api/shared/file-1/download',
      query: {
        offset: '0',
        length: String(5 * 1024 * 1024),
      },
      requestId: 'request-download-file',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(respondFile).toHaveBeenCalledWith(
      'request-download-file',
      206,
      {
        'content-length': String(5 * 1024 * 1024),
        'content-type': 'application/octet-stream',
      },
      '/data/storage/file.bin',
      0,
      5 * 1024 * 1024,
    );
    expect(respond).not.toHaveBeenCalled();
  });
});
