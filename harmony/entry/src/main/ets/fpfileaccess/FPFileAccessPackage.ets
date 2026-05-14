import { RNPackage, TurboModulesFactory } from '@rnoh/react-native-openharmony/ts';
import type { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { FPFileAccessTurboModule } from './FPFileAccessTurboModule';

const LOG_DOMAIN: number = 0x0000;
const LOG_TAG: string = 'FPFileAccess';

class FPFileAccessTurboModulesFactory extends TurboModulesFactory {
  createTurboModule(name: string): TurboModule | null {
    if (this.hasTurboModule(name)) {
      hilog.info(LOG_DOMAIN, LOG_TAG, 'createTurboModule FPFileAccess');
      return new FPFileAccessTurboModule(this.ctx);
    }

    return null;
  }

  hasTurboModule(name: string): boolean {
    const matches = name === 'FPFileAccess';
    if (matches) {
      hilog.info(LOG_DOMAIN, LOG_TAG, 'hasTurboModule FPFileAccess');
    }
    return matches;
  }
}

export class FPFileAccessPackage extends RNPackage {
  getDebugName(): string {
    return 'FPFileAccessPackage';
  }

  createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new FPFileAccessTurboModulesFactory(ctx);
  }
}
