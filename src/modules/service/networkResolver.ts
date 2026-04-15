import {NetworkMode, NetworkSnapshot} from './models';

function inferSnapshotFromBindAddress(
  address: string,
): Pick<NetworkSnapshot, 'mode' | 'label' | 'interfaceName'> {
  if (/^10\.0\.2\./.test(address)) {
    return {
      mode: 'unknown',
      label: '安卓模拟器',
      interfaceName: 'emulator',
    };
  }

  if (
    /^192\.168\.43\./.test(address) ||
    /^192\.168\.137\./.test(address) ||
    /^192\.168\.49\./.test(address)
  ) {
    return {
      mode: 'hotspot',
      label: '手机热点',
      interfaceName: '热点 (HTTP)',
    };
  }

  return {
    mode: 'unknown',
    label: '本机网络',
    interfaceName: 'HTTP 服务',
  };
}

/**
 * NetInfo 在热点等场景下常拿不到 IPv4，此时用 HTTP runtime 的 bind 地址兜底。
 * 若仍沿用离线态的 label，界面会一直显示「无可用局域网」——这里按地址重写展示字段。
 */
export function mergeNetworkSnapshotWithRuntimeAddress(
  probed: NetworkSnapshot,
  runtimeAddress: string | undefined,
): NetworkSnapshot {
  const address = runtimeAddress ?? probed.address;
  if (!address) {
    return probed;
  }

  if (probed.reachable) {
    return {
      ...probed,
      address,
    };
  }

  const inferred = inferSnapshotFromBindAddress(address);
  return {
    ...probed,
    ...inferred,
    reachable: true,
    address,
  };
}

export interface NetworkInterfaceDescriptor {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  modeHint?: Exclude<NetworkMode, 'offline' | 'unknown'>;
}

function rankCandidate(candidate: NetworkInterfaceDescriptor) {
  if (candidate.internal || candidate.family !== 'IPv4') {
    return -1;
  }

  if (candidate.modeHint === 'hotspot') {
    return 3;
  }

  if (candidate.modeHint === 'wifi') {
    return 2;
  }

  if (/hotspot|tether|ap/i.test(candidate.name)) {
    return 3;
  }

  if (/wi-?fi|wlan/i.test(candidate.name)) {
    return 2;
  }

  return 1;
}

function inferMode(candidate: NetworkInterfaceDescriptor): NetworkMode {
  if (candidate.modeHint) {
    return candidate.modeHint;
  }

  if (/hotspot|tether|ap/i.test(candidate.name)) {
    return 'hotspot';
  }

  if (/wi-?fi|wlan/i.test(candidate.name)) {
    return 'wifi';
  }

  return 'unknown';
}

export function resolveNetworkSnapshot(
  interfaces: NetworkInterfaceDescriptor[],
): NetworkSnapshot {
  const candidate = interfaces
    .filter(entry => !entry.internal && entry.family === 'IPv4')
    .sort((left, right) => rankCandidate(right) - rankCandidate(left))[0];

  if (!candidate) {
    return {
      mode: 'offline',
      label: '无可用局域网',
      reachable: false,
    };
  }

  const mode = inferMode(candidate);

  return {
    mode,
    label:
      mode === 'wifi'
        ? '公共 Wi-Fi'
        : mode === 'hotspot'
          ? '手机热点'
          : '未知网络',
    reachable: true,
    address: candidate.address,
    interfaceName: candidate.name,
  };
}
