import NetInfo, {NetInfoState, NetInfoStateType} from '@react-native-community/netinfo';

import {NetworkInterfaceDescriptor} from './networkResolver';

function getAddressFamily(address: string) {
  return address.includes(':') ? 'IPv6' : 'IPv4';
}

function createInterfaceDescriptor(
  stateType: NetInfoStateType,
  address: string,
): NetworkInterfaceDescriptor {
  if (stateType === NetInfoStateType.cellular) {
    return {
      address,
      family: getAddressFamily(address),
      internal: false,
      modeHint: 'hotspot',
      name: 'Cellular Hotspot',
    };
  }

  if (
    stateType === NetInfoStateType.wifi ||
    stateType === NetInfoStateType.ethernet
  ) {
    return {
      address,
      family: getAddressFamily(address),
      internal: false,
      modeHint: 'wifi',
      name: stateType === NetInfoStateType.wifi ? 'Wi-Fi' : 'Ethernet',
    };
  }

  return {
    address,
    family: getAddressFamily(address),
    internal: false,
    name: stateType,
  };
}

export function resolveInterfacesFromNetInfoState(
  state: NetInfoState,
): NetworkInterfaceDescriptor[] {
  if (!state.isConnected || !state.details) {
    return [];
  }

  const details = state.details as {ipAddress?: string | null};
  const address = details.ipAddress?.trim();
  if (!address) {
    return [];
  }

  return [createInterfaceDescriptor(state.type, address)];
}

export async function fetchNetworkInterfacesFromNetInfo() {
  const state = await NetInfo.fetch();
  return resolveInterfacesFromNetInfoState(state);
}
