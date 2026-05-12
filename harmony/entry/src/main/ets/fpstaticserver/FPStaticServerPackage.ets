import { RNPackage, TurboModulesFactory } from '@rnoh/react-native-openharmony/ts';
import type { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { FPStaticServerTurboModule } from './FPStaticServerTurboModule';

class FPStaticServerTurboModulesFactory extends TurboModulesFactory {
  createTurboModule(name: string): TurboModule | null {
    if (this.hasTurboModule(name)) {
      return new FPStaticServerTurboModule(this.ctx);
    }

    return null;
  }

  hasTurboModule(name: string): boolean {
    return name === 'FPStaticServer';
  }
}

export class FPStaticServerPackage extends RNPackage {
  createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
    return new FPStaticServerTurboModulesFactory(ctx);
  }
}
