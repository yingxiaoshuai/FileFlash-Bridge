import { createReactNativeTcpHttpRuntime } from '../modules/service/reactNativeTcpHttpRuntime';
import type {
  ServiceRuntime,
} from '../modules/service/transferServiceController';

export function createPlatformServiceRuntime(): ServiceRuntime {
  return createReactNativeTcpHttpRuntime();
}
