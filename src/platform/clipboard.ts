import Clipboard from '@react-native-clipboard/clipboard';

export function setClipboardString(value: string) {
  Clipboard.setString(value);
}
