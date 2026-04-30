import {NativeModules, Platform} from 'react-native';

type NativeDeviceStateModule = {
  setIdleTimerDisabled?: (disabled: boolean) => void;
};

const nativeDeviceState = NativeModules.FPDeviceState as
  | NativeDeviceStateModule
  | undefined;

export function setPlatformIdleTimerDisabled(disabled: boolean) {
  if (Platform.OS !== 'ios') {
    return;
  }

  nativeDeviceState?.setIdleTimerDisabled?.(disabled);
}
