import {
  RNApp,
  RNOHCoreContext,
  RNOHErrorDialog,
  ResourceJSBundleProvider,
} from '@rnoh/react-native-openharmony';
import {getRNOHPackages} from '../PackageProvider';

@Entry
@Component
struct Index {
  @StorageLink('RNOHCoreContext')
  private rnohCoreContext: RNOHCoreContext | undefined = undefined;

  build() {
    Column() {
      if (this.rnohCoreContext) {
        if (this.rnohCoreContext?.isDebugModeEnabled) {
          RNOHErrorDialog({ctx: this.rnohCoreContext});
        }
        RNApp({
          rnInstanceConfig: {
            name: 'FileFlashBridge',
            createRNPackages: getRNOHPackages,
            fontResourceByFontFamily: {},
            enableDebugger: this.rnohCoreContext?.isDebugModeEnabled,
          },
          appKey: 'FileFlashBridge',
          jsBundleProvider: new ResourceJSBundleProvider(
            this.rnohCoreContext.uiAbilityContext.resourceManager,
            'bundle.harmony.js',
          ),
        });
      }
    }
    .height('100%')
    .width('100%');
  }
}
