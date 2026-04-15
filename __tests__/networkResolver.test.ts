import {
  mergeNetworkSnapshotWithRuntimeAddress,
  resolveNetworkSnapshot,
} from '../src/modules/service/networkResolver';

describe('resolveNetworkSnapshot', () => {
  test('returns offline when no usable IPv4', () => {
    expect(resolveNetworkSnapshot([])).toEqual({
      mode: 'offline',
      label: '无可用局域网',
      reachable: false,
    });
  });
});

describe('mergeNetworkSnapshotWithRuntimeAddress', () => {
  const offline = resolveNetworkSnapshot([]);

  test('keeps reachable probe unchanged except optional address fill', () => {
    const probed = resolveNetworkSnapshot([
      {
        address: '192.168.1.10',
        family: 'IPv4',
        internal: false,
        name: 'wlan0',
        modeHint: 'wifi',
      },
    ]);
    expect(
      mergeNetworkSnapshotWithRuntimeAddress(probed, '10.0.0.9'),
    ).toMatchObject({
      ...probed,
      address: '192.168.1.10',
    });
  });

  test('relabels offline probe when runtime exposes hotspot range', () => {
    expect(
      mergeNetworkSnapshotWithRuntimeAddress(offline, '192.168.43.1'),
    ).toEqual({
      mode: 'hotspot',
      label: '手机热点',
      reachable: true,
      address: '192.168.43.1',
      interfaceName: '热点 (HTTP)',
    });
  });

  test('relabels emulator bind address', () => {
    expect(
      mergeNetworkSnapshotWithRuntimeAddress(offline, '10.0.2.15'),
    ).toEqual({
      mode: 'unknown',
      label: '安卓模拟器',
      reachable: true,
      address: '10.0.2.15',
      interfaceName: 'emulator',
    });
  });

  test('generic private IP becomes 本机网络', () => {
    expect(
      mergeNetworkSnapshotWithRuntimeAddress(offline, '192.168.1.88'),
    ).toEqual({
      mode: 'unknown',
      label: '本机网络',
      reachable: true,
      address: '192.168.1.88',
      interfaceName: 'HTTP 服务',
    });
  });
});
