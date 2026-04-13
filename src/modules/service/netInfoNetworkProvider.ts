import NetInfo, {NetInfoState, NetInfoStateType} from '@react-native-community/netinfo';

import {NetworkInterfaceDescriptor} from './networkResolver';

function getAddressFamily(address: string) {
  return address.includes(':') ? 'IPv6' : 'IPv4';
}

export function resolveInterfacesFromNetInfoState(
  state: NetInfoState,
): NetworkInterfaceDescriptor[] {
  if (!state.isConnected || !state.details) {
    return [];
  }

  if (
    state.type === NetInfoStateType.wifi ||
    state.type === NetInfoStateType.ethernet
  ) {
    const address = state.details.ipAddress;
    if (!address) {
      return [];
    }

    return [
      {
        address,
        family: getAddressFamily(address),
        internal: false,
        modeHint: 'wifi',
        name: state.type === NetInfoStateType.wifi ? 'Wi-Fi' : 'Ethernet',
      },
    ];
  }

  if (state.type === NetInfoStateType.cellular) {
    const details = state.details as {ipAddress?: string | null};
    if (!details.ipAddress) {
      return [];
    }

    return [
      {
        address: details.ipAddress,
        family: getAddressFamily(details.ipAddress),
        internal: false,
        modeHint: 'hotspot',
        name: 'Cellular Hotspot',
      },
    ];
  }

  return [];
}

export async function fetchNetworkInterfacesFromNetInfo() {
  const state = await NetInfo.fetch();
  return resolveInterfacesFromNetInfoState(state);
}
