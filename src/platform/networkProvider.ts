import { fetchNetworkInterfacesFromNetInfo } from '../modules/service/netInfoNetworkProvider';
import type { NetworkInterfaceDescriptor } from '../modules/service/networkResolver';

import {
  createUnsupportedHarmonyFeatureError,
  isHarmonyPlatform,
} from './platform';

export async function fetchPlatformNetworkInterfaces(): Promise<
  NetworkInterfaceDescriptor[]
> {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('network detection');
  }

  return fetchNetworkInterfacesFromNetInfo();
}
