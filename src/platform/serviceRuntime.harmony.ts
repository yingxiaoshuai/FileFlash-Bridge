import { createReactNativeHttpRuntime } from '../modules/service/reactNativeHttpRuntime';
import type {
  ServiceRuntime,
} from '../modules/service/transferServiceController';

export function createPlatformServiceRuntime(): ServiceRuntime {
  return createReactNativeHttpRuntime();
}
