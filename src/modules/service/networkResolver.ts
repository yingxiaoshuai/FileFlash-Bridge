import {NetworkMode, NetworkSnapshot} from './models';

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
