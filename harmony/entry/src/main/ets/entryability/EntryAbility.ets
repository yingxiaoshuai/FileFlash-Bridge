import { AbilityConstant, Want } from '@kit.AbilityKit';
import { RNAbility } from '@rnoh/react-native-openharmony';
import { captureInboundWant } from '../fpinboundsharing/ShareInbox';

export default class EntryAbility extends RNAbility {
  override onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    super.onCreate(want, launchParam);
    captureInboundWant(this.context, want);
  }

  override onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    super.onNewWant(want, launchParam);
    captureInboundWant(this.context, want);
  }

  override getPagePath(): string {
    return 'pages/Index';
  }

  override getRNOHWorkerScriptUrl(): string {
    return 'entry/ets/workers/RNOHWorker.ets';
  }
}
