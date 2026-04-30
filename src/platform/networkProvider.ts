import { fetchNetworkInterfacesFromNetInfo } from '../modules/service/netInfoNetworkProvider';
import type { NetworkInterfaceDescriptor } from '../modules/service/networkResolver';

export async function fetchPlatformNetworkInterfaces(): Promise<
  NetworkInterfaceDescriptor[]
> {
  return fetchNetworkInterfacesFromNetInfo();
}
