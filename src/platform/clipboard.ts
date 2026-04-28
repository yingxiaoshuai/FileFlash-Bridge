import Clipboard from '@react-native-clipboard/clipboard';

import {
  createUnsupportedHarmonyFeatureError,
  isHarmonyPlatform,
} from './platform';

export function setClipboardString(value: string) {
  if (isHarmonyPlatform()) {
    throw createUnsupportedHarmonyFeatureError('clipboard');
  }

  Clipboard.setString(value);
}
