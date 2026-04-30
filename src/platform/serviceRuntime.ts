import { createReactNativeHttpRuntime } from '../modules/service/reactNativeHttpRuntime';
import { createReactNativeTcpHttpRuntime } from '../modules/service/reactNativeTcpHttpRuntime';
import type {
  ServiceRuntime,
} from '../modules/service/transferServiceController';

import { isHarmonyPlatform } from './platform';

export function createPlatformServiceRuntime(): ServiceRuntime {
  if (isHarmonyPlatform()) {
    return createReactNativeTcpHttpRuntime();
  }

  return createReactNativeHttpRuntime();
}
