import { createReactNativeHttpRuntime } from '../modules/service/reactNativeHttpRuntime';
import type {
  ServiceRuntime,
  ServiceRuntimeHandle,
  TransferRequest,
  TransferResponse,
} from '../modules/service/transferServiceController';

import {
  createUnsupportedHarmonyFeatureError,
  isHarmonyPlatform,
} from './platform';

class UnsupportedHarmonyServiceRuntime implements ServiceRuntime {
  async start(_options: {
    handler: (request: TransferRequest) => Promise<TransferResponse>;
    port: number;
  }): Promise<ServiceRuntimeHandle> {
    throw createUnsupportedHarmonyFeatureError('the local transfer service');
  }

  async isRunning() {
    return false;
  }
}

export function createPlatformServiceRuntime(): ServiceRuntime {
  if (isHarmonyPlatform()) {
    return new UnsupportedHarmonyServiceRuntime();
  }

  return createReactNativeHttpRuntime();
}
